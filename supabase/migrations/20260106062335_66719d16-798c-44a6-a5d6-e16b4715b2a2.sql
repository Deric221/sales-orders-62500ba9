-- Add RLS policy to block direct client inserts to notifications table
-- Notifications can only be created via the service role (edge functions)
CREATE POLICY "Block direct user inserts to notifications"
ON public.notifications FOR INSERT
WITH CHECK (false);

-- Add a comment explaining the security model
COMMENT ON TABLE public.notifications IS 'Notifications can only be created via the create-notification edge function using service role. Direct client inserts are blocked by RLS for security.';