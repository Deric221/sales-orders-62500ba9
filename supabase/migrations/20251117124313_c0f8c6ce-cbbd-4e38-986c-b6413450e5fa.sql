-- Update RLS policy to allow all managers to approve expense tickets from any department
DROP POLICY IF EXISTS "Employees managers and directors can update tickets" ON expense_tickets;

CREATE POLICY "Employees managers and directors can update tickets"
ON expense_tickets
FOR UPDATE
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