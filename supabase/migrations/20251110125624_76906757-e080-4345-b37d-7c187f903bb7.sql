-- Fix RLS policy for manager-to-manager expense ticket approvals
-- The issue is that the WITH CHECK clause was too restrictive for manager updates

DROP POLICY IF EXISTS "Employees and managers can update their tickets" ON expense_tickets;

CREATE POLICY "Employees and managers can update their tickets"
ON expense_tickets
FOR UPDATE
USING (
  employee_id = auth.uid() 
  OR manager_id = auth.uid()
  OR has_department_role(auth.uid(), 'finance'::app_role_new)
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
  OR (
    has_employee_type(auth.uid(), 'manager'::employee_type) 
    AND status = 'pending_manager_approval'::expense_status
    AND employee_id <> auth.uid()
  )
)
WITH CHECK (
  employee_id = auth.uid()
  OR manager_id = auth.uid()
  OR has_department_role(auth.uid(), 'finance'::app_role_new)
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
  OR (
    has_employee_type(auth.uid(), 'manager'::employee_type)
    AND employee_id <> auth.uid()
  )
);