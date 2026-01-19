-- Fix 1: Update RLS policy for workflow_tracker to allow Finance to UPDATE when invoice_id is null
-- This fixes the "new row violates row-level security policy" error when Finance uploads invoices

DROP POLICY IF EXISTS "Finance can update workflows" ON public.workflow_tracker;

CREATE POLICY "Finance can update workflows for invoice generation"
ON public.workflow_tracker
FOR UPDATE
TO authenticated
USING (
  has_department_role(auth.uid(), 'finance'::app_role_new) AND
  (
    current_stage = 'project_completed'::workflow_stage OR 
    (current_stage = 'waybill_created'::workflow_stage AND project_id IS NULL)
  )
)
WITH CHECK (
  has_department_role(auth.uid(), 'finance'::app_role_new) AND
  (
    current_stage = 'invoice_generated'::workflow_stage OR
    current_stage = 'project_completed'::workflow_stage OR 
    (current_stage = 'waybill_created'::workflow_stage AND project_id IS NULL)
  )
);

-- Fix 2: Allow users with only employee_type to access expense dashboard
-- Update RLS policies to check employee_type even when department_role is null

-- Update expense_tickets SELECT policy
DROP POLICY IF EXISTS "Users can view expense tickets" ON public.expense_tickets;

CREATE POLICY "Users can view expense tickets"
ON public.expense_tickets
FOR SELECT
TO authenticated
USING (
  employee_id = auth.uid() OR
  manager_id = auth.uid() OR
  has_department_role(auth.uid(), 'finance'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new) OR
  (
    has_employee_type(auth.uid(), 'manager'::employee_type) AND
    status = 'pending_manager_approval'::expense_status AND
    employee_id != auth.uid()
  )
);

-- Update expense_tickets UPDATE policy
DROP POLICY IF EXISTS "Users can update tickets based on role" ON public.expense_tickets;

CREATE POLICY "Users can update tickets based on role"
ON public.expense_tickets
FOR UPDATE
TO authenticated
USING (
  employee_id = auth.uid() OR
  has_employee_type(auth.uid(), 'manager'::employee_type) OR
  has_department_role(auth.uid(), 'finance'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new)
)
WITH CHECK (
  employee_id = auth.uid() OR
  has_employee_type(auth.uid(), 'manager'::employee_type) OR
  has_department_role(auth.uid(), 'finance'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Update expense_tickets INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create their own tickets" ON public.expense_tickets;

CREATE POLICY "Authenticated users can create their own tickets"
ON public.expense_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  employee_id = auth.uid()
);