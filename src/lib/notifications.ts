import { supabase } from "@/integrations/supabase/client";

interface NotificationPayload {
  user_id: string;
  title: string;
  message: string;
  related_type?: string;
  related_id?: string;
}

/**
 * Creates notifications securely via edge function.
 * This is the only way to create notifications - direct client inserts are blocked by RLS.
 */
export async function createNotification(notification: NotificationPayload): Promise<boolean> {
  return createNotifications([notification]);
}

/**
 * Creates multiple notifications securely via edge function.
 * This is the only way to create notifications - direct client inserts are blocked by RLS.
 */
export async function createNotifications(notifications: NotificationPayload[]): Promise<boolean> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      console.error("No active session for creating notifications");
      return false;
    }

    const { error } = await supabase.functions.invoke('create-notification', {
      body: { notifications },
      headers: {
        Authorization: `Bearer ${session.session.access_token}`,
      },
    });

    if (error) {
      console.error("Error creating notifications:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error creating notifications:", error);
    return false;
  }
}
