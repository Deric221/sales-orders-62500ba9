-- Fix notifications table RLS policy to prevent user impersonation
-- Remove the overly permissive INSERT policy that allows any user to create notifications for anyone

-- Drop the insecure policy
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Notifications should ONLY be created by:
-- 1. Database triggers (which bypass RLS using SECURITY DEFINER)
-- 2. Edge functions using service role key (which bypasses RLS)
-- No direct INSERT policy is needed since the notify_next_role() trigger already uses SECURITY DEFINER