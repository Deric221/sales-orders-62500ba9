import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  user_id: string;
  title: string;
  message: string;
  related_type?: string;
  related_id?: string;
}

interface BulkNotificationPayload {
  notifications: NotificationPayload[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with service role for inserting notifications
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client first for JWT verification
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Use getClaims for JWT verification (works both locally and in production)
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await adminClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("JWT verification failed:", claimsError);
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const user = { id: claimsData.claims.sub as string };

    // Parse request body
    const body = await req.json();
    
    // Support both single notification and bulk notifications
    let notifications: NotificationPayload[] = [];
    
    if (body.notifications && Array.isArray(body.notifications)) {
      notifications = body.notifications;
    } else if (body.user_id) {
      notifications = [body];
    } else {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate notification payloads
    for (const notification of notifications) {
      if (!notification.user_id || !notification.title || !notification.message) {
        return new Response(JSON.stringify({ error: "Each notification requires user_id, title, and message" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sanitize input - limit title and message length
      notification.title = String(notification.title).slice(0, 200);
      notification.message = String(notification.message).slice(0, 1000);
      
      // Validate related_type if provided
      const validRelatedTypes = ['workflow', 'expense_ticket', 'project', 'order'];
      if (notification.related_type && !validRelatedTypes.includes(notification.related_type)) {
        notification.related_type = undefined;
      }
    }

    // Use the same admin client to insert notifications (bypasses RLS)

    const { data, error: insertError } = await adminClient
      .from("notifications")
      .insert(notifications.map(n => ({
        user_id: n.user_id,
        title: n.title,
        message: n.message,
        related_type: n.related_type || null,
        related_id: n.related_id || null,
        is_read: false,
      })))
      .select();

    if (insertError) {
      console.error("Error inserting notifications:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create notifications" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, count: data?.length || 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in create-notification function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
