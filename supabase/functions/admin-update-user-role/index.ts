import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting (per-user)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // max requests
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

    const updateRoleSchema = z.object({
      userId: z.string().uuid("Invalid user ID format"),
      employeeType: z.enum(["employee", "manager"], {
        errorMap: () => ({ message: "Employee type must be 'employee' or 'manager'" })
      }),
      departmentId: z.string().uuid("Invalid department ID format").optional().nullable(),
      departmentRole: z.enum(["sales", "orders", "finance", "projects", "admin"], {
        errorMap: () => ({ message: "Invalid department role" })
      }).optional().nullable(),
      managerialRole: z.enum(["director_finance", "director_business", "director_cx", "head_compliance"], {
        errorMap: () => ({ message: "Invalid managerial role" })
      }).optional().nullable(),
    });

    const body = await req.json();
    const { userId, employeeType, departmentId, departmentRole, managerialRole } = updateRoleSchema.parse(body);

    // Prevent admins from removing their own admin role
    if (userId === user.id && departmentRole !== "admin") {
      throw new Error("Cannot remove your own admin privileges");
    }

    // Check if target user exists
    const { data: targetUser, error: targetUserError } = await supabaseClient.auth.admin.getUserById(userId);
    
    if (targetUserError || !targetUser) {
      throw new Error("Target user not found");
    }

    // Update or insert the user role (upsert)
    const { error: updateError } = await supabaseClient
      .from("user_roles")
      .upsert({
        user_id: userId,
        employee_type: employeeType,
        department_id: departmentId || null,
        department_role: departmentRole || null,
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      throw updateError;
    }

    // Handle managerial role assignment
    if (managerialRole && departmentId) {
      // First, remove any existing assignment for this role
      await supabaseClient
        .from("manager_assignments")
        .delete()
        .eq("role", managerialRole);

      // Then assign to this user
      const { error: managerError } = await supabaseClient
        .from("manager_assignments")
        .insert({
          user_id: userId,
          department_id: departmentId,
          role: managerialRole,
        });

      if (managerError) {
        throw managerError;
      }
    } else if (managerialRole === null) {
      // Remove managerial role if explicitly set to null
      await supabaseClient
        .from("manager_assignments")
        .delete()
        .eq("user_id", userId);
    }

    // Audit logging
    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'admin_update_user_role',
      table_name: 'user_roles',
      new_data: { 
        user_id: userId,
        employee_type: employeeType,
        department_id: departmentId,
        department_role: departmentRole,
        managerial_role: managerialRole,
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: "User role updated successfully" }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error('Admin update user role error:', error);
    
    let userMessage = "An error occurred while updating user role";
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
      } else if (error.message?.includes('not found')) {
        userMessage = "User not found";
        statusCode = 404;
      } else if (error.message?.includes('admin privileges')) {
        userMessage = error.message;
        statusCode = 403;
      } else if (error.message?.includes('Employee type') || error.message?.includes('department role')) {
        userMessage = error.message; // Validation messages are safe to show
      }
    }
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      { status: statusCode, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
