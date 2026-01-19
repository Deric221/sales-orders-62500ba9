-- Fix PUBLIC_DATA_EXPOSURE: Restrict customer_pos table access to authorized roles only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Everyone can view customer POs" ON public.customer_pos;

-- Create restrictive policy that only allows sales, orders, finance, and admin roles
CREATE POLICY "Authorized roles can view customer POs" 
  ON public.customer_pos 
  FOR SELECT
  USING (
    has_role(auth.uid(), 'sales'::app_role) OR 
    has_role(auth.uid(), 'orders'::app_role) OR 
    has_role(auth.uid(), 'finance'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  );