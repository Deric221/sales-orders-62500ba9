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
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized: Invalid token");
    }

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

    const resetPasswordSchema = z.object({
      userId: z.string().uuid("Invalid user ID format"),
      newPassword: z.string()
        .min(12, "Password must be at least 12 characters")
        .regex(/[a-z]/, "Password must contain a lowercase letter")
        .regex(/[A-Z]/, "Password must contain an uppercase letter")
        .regex(/[0-9]/, "Password must contain a number")
        .regex(/[^a-zA-Z0-9]/, "Password must contain a special character"),
    });

    const body = await req.json();
    const { userId, newPassword } = resetPasswordSchema.parse(body);

    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      throw updateError;
    }

    // Audit logging (don't log the actual password)
    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'admin_reset_password',
      table_name: 'auth.users',
      new_data: { 
        user_id: userId,
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error('Admin reset password error:', error);
    
    let userMessage = "An error occurred while resetting password";
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
      } else if (error.message?.includes('Password')) {
        userMessage = error.message; // Password validation messages are safe to show
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
