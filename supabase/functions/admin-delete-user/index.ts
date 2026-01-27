import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting (per-user)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max requests
const RATE_WINDOW = 60000; // per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Invalid authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Use getClaims for JWT verification (works both locally and in production)
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("JWT verification failed:", claimsError);
      throw new Error("Unauthorized: Invalid token");
    }
    
    const user = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string };

    // Rate limiting check
    if (!checkRateLimit(user.id)) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    // Verify token has email (defense in depth - ensure valid JWT structure)
    if (!user.email) {
      throw new Error("Unauthorized: Invalid user session");
    }

    // Check if user is admin (dual verification)
    const { data: userRole, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("department_role, user_id")
      .eq("user_id", user.id)
      .single();

    if (roleError || !userRole) {
      throw new Error("Unauthorized: User role not found");
    }

    // Defense in depth: verify user_id matches
    if (userRole.user_id !== user.id) {
      throw new Error("Unauthorized: Role verification failed");
    }

    if (userRole.department_role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    const deleteUserSchema = z.object({
      userId: z.string().uuid("Invalid user ID format"),
    });

    const body = await req.json();
    const { userId } = deleteUserSchema.parse(body);

    // Get user details before deletion for audit log
    const { data: userData } = await supabaseClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    // Delete user from auth
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw deleteError;
    }

    // Audit logging
    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'admin_delete_user',
      table_name: 'auth.users',
      old_data: { 
        user_id: userId,
        email: userData?.email,
        full_name: userData?.full_name,
      },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error('Admin delete user error:', error);
    
    let userMessage = "An error occurred while deleting user";
    let statusCode = 400;
    
    if (error instanceof Error) {
      if (error.message?.includes('Unauthorized')) {
        userMessage = "Unauthorized";
        statusCode = 403;
      } else if (error.message?.includes('Rate limit')) {
        userMessage = "Too many requests. Please try again later.";
        statusCode = 429;
      } else if (error.message?.includes('required')) {
        userMessage = "Missing required fields";
      } else if (error.message?.toLowerCase().includes('not found')) {
        userMessage = "User not found";
        statusCode = 404;
      }
    }
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      { status: statusCode, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
