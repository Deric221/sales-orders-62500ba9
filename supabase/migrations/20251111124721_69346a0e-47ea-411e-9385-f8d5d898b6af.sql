-- Fix 1: Make audit_logs.record_id nullable to prevent constraint violations
ALTER TABLE public.audit_logs 
ALTER COLUMN record_id DROP NOT NULL;

-- Fix 2: Remove overly permissive INSERT policies on system tables
-- These tables should only be written to by triggers and edge functions with service role

-- Drop the overly permissive policy on notifications
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Drop the overly permissive policy on audit_logs  
DROP POLICY IF EXISTS "System can create audit logs" ON public.audit_logs;

-- Fix 3: Consolidate duplicate storage policies on expense-retirements bucket
-- Drop all 8 overlapping policies

-- Drop INSERT policies (3 total)
DROP POLICY IF EXISTS "Employees upload retirement for owned paid tickets" ON storage.objects;
DROP POLICY IF EXISTS "Employees can upload retirement documents" ON storage.objects;
DROP POLICY IF EXISTS "Retirements: owner can upload" ON storage.objects;

-- Drop SELECT policies (5 total)
DROP POLICY IF EXISTS "Users can view retirement docs of their tickets" ON storage.objects;
DROP POLICY IF EXISTS "Finance can view all retirement documents" ON storage.objects;
DROP POLICY IF EXISTS "Finance can view retirement documents" ON storage.objects;
DROP POLICY IF EXISTS "Retirements: owner, finance, admin can read" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their retirement documents" ON storage.objects;

-- Create single clear upload policy enforcing business rules
CREATE POLICY "Upload retirement documents for paid tickets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'expense-retirements'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.expense_tickets
    WHERE id::text = split_part(name, '/', 2)
    AND employee_id = auth.uid()
    AND status = 'paid'::expense_status
  )
);

-- Create single clear read policy
CREATE POLICY "View retirement documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'expense-retirements'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_department_role(auth.uid(), 'finance'::app_role_new)
    OR has_department_role(auth.uid(), 'admin'::app_role_new)
  )
);