-- Fix quotes table RLS policy to restrict access to authorized roles only
-- This prevents unauthorized employees from viewing sensitive customer quote data

DROP POLICY IF EXISTS "Everyone can view quotes" ON public.quotes;

CREATE POLICY "Authorized roles can view quotes" 
  ON public.quotes 
  FOR SELECT
  USING (
    has_role(auth.uid(), 'sales'::app_role) OR 
    has_role(auth.uid(), 'orders'::app_role) OR 
    has_role(auth.uid(), 'finance'::app_role) OR 
    has_role(auth.uid(), 'projects'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  );