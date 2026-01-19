-- Fix profiles RLS to allow managers and admins to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  -- Users can see their own profile
  auth.uid() = id
  -- Managers can see all profiles
  OR has_employee_type(auth.uid(), 'manager'::employee_type)
  -- Admins can see all profiles
  OR has_role(auth.uid(), 'admin'::app_role)
  -- Finance can see all profiles
  OR has_role(auth.uid(), 'finance'::app_role)
);

-- Fix the UPDATE policy to include WITH CHECK clause
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
)
WITH CHECK (
  -- Same conditions for the updated row
  employee_id = auth.uid()
  OR manager_id = auth.uid()
  OR has_role(auth.uid(), 'finance'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_employee_type(auth.uid(), 'manager'::employee_type)
    AND employee_id <> auth.uid()
  )
);