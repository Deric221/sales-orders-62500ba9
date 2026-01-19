-- Correct UPDATE policy to avoid status restriction on NEW rows
DROP POLICY IF EXISTS "Employees and managers can update their tickets" ON public.expense_tickets;

CREATE POLICY "Employees and managers can update their tickets"
ON public.expense_tickets
FOR UPDATE
USING (
  -- Actor can update the existing row if any of these are true
  employee_id = auth.uid()
  OR manager_id = auth.uid()
  OR has_department_role(auth.uid(), 'finance'::app_role_new)
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
  OR (
    -- Peer manager acting on someone else's pending ticket
    has_employee_type(auth.uid(), 'manager'::employee_type)
    AND status = 'pending_manager_approval'::expense_status
    AND employee_id <> auth.uid()
  )
)
WITH CHECK (
  -- NEW row must satisfy one of these (no status restriction here)
  employee_id = auth.uid()
  OR manager_id = auth.uid()
  OR has_department_role(auth.uid(), 'finance'::app_role_new)
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
  OR (
    has_employee_type(auth.uid(), 'manager'::employee_type)
    AND employee_id <> auth.uid()
  )
);