-- Allow peer managers to approve manager-submitted tickets
DROP POLICY IF EXISTS "Employees and managers can update their tickets" ON public.expense_tickets;

CREATE POLICY "Employees and managers can update their tickets"
ON public.expense_tickets
FOR UPDATE
USING (
  -- Ticket owner can update
  employee_id = auth.uid()
  -- Assigned manager can update
  OR manager_id = auth.uid()
  -- Finance and admin can update
  OR has_role(auth.uid(), 'finance'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  -- Any manager can act on other managers' pending tickets (peer approval)
  OR (
    has_employee_type(auth.uid(), 'manager'::employee_type)
    AND status = 'pending_manager_approval'::expense_status
    AND employee_id <> auth.uid()
  )
);