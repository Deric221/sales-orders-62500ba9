-- Update RLS policy to allow managers to see other managers' pending tickets
DROP POLICY IF EXISTS "Users can view their expense tickets" ON public.expense_tickets;

CREATE POLICY "Users can view their expense tickets"
ON public.expense_tickets
FOR SELECT
USING (
  -- Can view own tickets
  employee_id = auth.uid()
  -- Can view tickets assigned to them as manager
  OR manager_id = auth.uid()
  -- Finance and admin can view all
  OR has_role(auth.uid(), 'finance'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  -- Managers can view other managers' pending tickets
  OR (
    has_employee_type(auth.uid(), 'manager'::employee_type)
    AND status = 'pending_manager_approval'::expense_status
    AND employee_id != auth.uid()
  )
);