import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

// Input validation schema using Zod
const workflowNotificationSchema = z.object({
  workflowId: z.string().uuid("Invalid workflow ID format"),
  stage: z.enum(["customer_po_uploaded", "company_po_uploaded", "waybill_created", "waybill_created_with_project", "project_completed"]),
  quoteNumber: z.string().trim().min(3).max(50),
  customerName: z.string().trim().min(2).max(200)
});

// HTML escape function
const escapeHtml = (unsafe: string): string => 
  unsafe.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m] || m));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", {
        error: authError?.message,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input
    const body = await req.json();
    const validated = workflowNotificationSchema.parse(body);
    
    // Escape HTML
    const safeQuoteNumber = escapeHtml(validated.quoteNumber);
    const safeCustomerName = escapeHtml(validated.customerName);

    // Determine which role to notify based on stage
    let targetRole: string;
    let emailSubject: string;
    let emailBody: string;

    if (validated.stage === "customer_po_uploaded") {
      targetRole = "orders";
      emailSubject = "New Customer PO Ready";
      emailBody = `Customer PO for quote ${safeQuoteNumber} (${safeCustomerName}) is ready for company PO creation.`;
    } else if (validated.stage === "company_po_uploaded") {
      targetRole = "orders";
      emailSubject = "Company PO Created - Awaiting Waybill";
      emailBody = `Company PO created for quote ${safeQuoteNumber} (${safeCustomerName}). Please create waybill.`;
    } else if (validated.stage === "waybill_created") {
      targetRole = "finance";
      emailSubject = "Waybill Created - Ready for Invoice";
      emailBody = `Waybill created for quote ${safeQuoteNumber} (${safeCustomerName}). This order has no project and is ready for invoice generation.`;
    } else if (validated.stage === "waybill_created_with_project") {
      targetRole = "projects";
      emailSubject = "New Project Assignment";
      emailBody = `Waybill created for quote ${safeQuoteNumber} (${safeCustomerName}). A project is assigned to this order. Please proceed with project implementation.`;
    } else if (validated.stage === "project_completed") {
      targetRole = "finance";
      emailSubject = "Project Completed - Ready for Invoice";
      emailBody = `Project for quote ${safeQuoteNumber} (${safeCustomerName}) is completed. Ready for invoice generation.`;
    } else {
      throw new Error("Invalid workflow stage");
    }

    // Get users with this role - query separately to avoid relationship issues
    const { data: roleUsers, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("user_id")
      .eq("department_role", targetRole);
    
    if (roleError) {
      console.error("Role query error:", roleError);
      throw roleError;
    }
    
    if (!roleUsers || roleUsers.length === 0) {
      console.log(`No users found with role ${targetRole}`);
      return new Response(
        JSON.stringify({ message: "No users to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get profiles for these users
    const userIds = roleUsers.map(r => r.user_id);
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    
    if (profilesError) {
      console.error("Profiles query error:", profilesError);
      throw profilesError;
    }
    
    const users = profiles || [];
    console.log(`Sending emails to ${users.length} users with role ${targetRole}`);

    // Send emails to all users with this role
    const emailPromises = users.map(async (user: any) => {
      const email = user.email;
      const name = user.full_name || "Team Member";

      if (!email) {
        console.log(`Skipping user ${user.id} - no email`);
        return;
      }

      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Workflow Notifications <onboarding@resend.dev>",
            to: [email],
            subject: emailSubject,
            html: `
              <h2>Hello ${escapeHtml(name)},</h2>
              <p>${emailBody}</p>
              <p>Please log in to your dashboard to take action.</p>
              <br/>
              <p>Best regards,<br/>The System</p>
            `,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`Failed to send email to ${email}:`, errorText);
        } else {
          console.log(`Email sent successfully to ${email}`);
        }
      } catch (emailError: any) {
        console.error(`Exception sending email to ${email}:`, emailError);
      }
    });

    await Promise.all(emailPromises);

    return new Response(
      JSON.stringify({ success: true, message: `Notifications sent to ${users.length} users` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    // Log full error server-side
    console.error("Workflow notification error:", {
      function: "send-workflow-notification",
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Return generic error to client
    let userMessage = "Failed to send notification";
    let statusCode = 500;
    
    if (error instanceof z.ZodError) {
      userMessage = "Invalid input data";
      statusCode = 400;
    }
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
