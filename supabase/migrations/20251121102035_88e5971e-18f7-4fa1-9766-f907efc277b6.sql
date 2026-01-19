-- Fix RLS policy for expense_tickets to allow employees without department assignments to access

-- Drop the old policy that requires employee_type check
DROP POLICY IF EXISTS "Employees can create their own tickets" ON expense_tickets;

-- Create new policy that allows all authenticated users to create their own tickets
CREATE POLICY "Authenticated users can create their own tickets"
ON expense_tickets
FOR INSERT
TO authenticated
WITH CHECK (employee_id = auth.uid());

-- Also update the select policy to allow employees to view their own tickets without strict role checks
DROP POLICY IF EXISTS "Users can view expense tickets" ON expense_tickets;

CREATE POLICY "Users can view expense tickets"
ON expense_tickets
FOR SELECT
TO authenticated
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
);

-- Update the update policy as well
DROP POLICY IF EXISTS "Employees managers and directors can update tickets" ON expense_tickets;

CREATE POLICY "Users can update tickets based on role"
ON expense_tickets
FOR UPDATE
TO authenticated
USING (
  employee_id = auth.uid() 
  OR has_employee_type(auth.uid(), 'manager'::employee_type)
  OR has_department_role(auth.uid(), 'finance'::app_role_new)
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
)
WITH CHECK (
  employee_id = auth.uid() 
  OR has_employee_type(auth.uid(), 'manager'::employee_type)
  OR has_department_role(auth.uid(), 'finance'::app_role_new)
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);