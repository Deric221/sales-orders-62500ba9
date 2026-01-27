import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

// Input validation schema
const expenseNotificationSchema = z.object({
  ticketId: z.string().uuid("Invalid ticket ID format"),
  employeeName: z.string().trim().min(2).max(100),
  ticketNumber: z.string().trim().min(3).max(50),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format"),
  managerId: z.string().uuid("Invalid manager ID format")
});

// HTML escape function to prevent XSS
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

    // Verify JWT authentication using getClaims (works locally and in production)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.error("Auth error:", {
        error: claimsError?.message,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const user = { id: claimsData.claims.sub as string };

    // Validate input
    const body = await req.json();
    const validated = expenseNotificationSchema.parse(body);

    // Verify the user is authorized to trigger notification for this ticket
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('expense_tickets')
      .select('employee_id')
      .eq('id', validated.ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error("Ticket verification error:", {
        error: ticketError?.message,
        ticketId: validated.ticketId,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (ticket.employee_id !== user.id) {
      console.error("Authorization failed:", {
        userId: user.id,
        ticketEmployeeId: ticket.employee_id,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: 'Not authorized for this ticket' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Escape HTML to prevent XSS
    const safeEmployeeName = escapeHtml(validated.employeeName);
    const safeTicketNumber = escapeHtml(validated.ticketNumber);
    const safeAmount = escapeHtml(validated.amount);

    // Get manager's email
    const { data: manager, error: managerError } = await supabaseClient
      .from("profiles")
      .select("email, full_name")
      .eq("id", validated.managerId)
      .single();

    if (managerError || !manager || !manager.email) {
      console.error("Manager query error:", {
        error: managerError?.message,
        managerId: validated.managerId,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Recipient not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending expense notification to ${manager.email}`);

    // Send email to manager
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Expense Notifications <onboarding@resend.dev>",
        to: [manager.email],
        subject: "New Expense Ticket for Approval",
        html: `
          <h2>Hello ${escapeHtml(manager.full_name || "Manager")},</h2>
          <p>A new expense ticket has been submitted and requires your approval.</p>
          <ul>
            <li><strong>Ticket Number:</strong> ${safeTicketNumber}</li>
            <li><strong>Employee:</strong> ${safeEmployeeName}</li>
            <li><strong>Amount:</strong> GHS ${safeAmount}</li>
          </ul>
          <p>Please log in to your dashboard to review and approve/reject this expense.</p>
          <br/>
          <p>Best regards,<br/>The System</p>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Failed to send email:", errorText);
      throw new Error("Failed to send email");
    }

    console.log("Email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Email sent to manager" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    // Log full error server-side
    console.error("Notification error:", {
      function: "send-expense-notification",
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
    } else if (error.message?.includes("not found")) {
      userMessage = "Recipient not found";
      statusCode = 404;
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
