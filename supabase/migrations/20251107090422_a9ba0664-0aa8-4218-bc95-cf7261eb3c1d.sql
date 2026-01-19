-- Fix policies to use employee_type for manager checks

-- 1) Profiles: allow managers (by employee_type), finance, and admins to view all profiles
DROP POLICY IF EXISTS "Profiles are viewable by self, managers, finance, admins" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by self, managers, finance, admins"
ON public.profiles
FOR SELECT
USING (
  -- Self
  auth.uid() = id
  -- Managers (employee type)
  OR has_employee_type(auth.uid(), 'manager'::employee_type)
  -- Finance and Admins (department roles)
  OR has_department_role(auth.uid(), 'finance'::app_role_new)
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- 2) Expense tickets: update policy uses employee_type for manager checks
DROP POLICY IF EXISTS "Employees and managers can update their tickets" ON public.expense_tickets;

CREATE POLICY "Employees and managers can update their tickets"
ON public.expense_tickets
FOR UPDATE
USING (
  -- Ticket owner
  employee_id = auth.uid()
  -- Assigned manager
  OR manager_id = auth.uid()
  -- Finance and admin (department roles)
  OR has_department_role(auth.uid(), 'finance'::app_role_new)
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
  -- Peer manager can act on manager-submitted tickets pending approval (employee_type)
  OR (
    has_employee_type(auth.uid(), 'manager'::employee_type)
    AND status = 'pending_manager_approval'::expense_status
    AND employee_id <> auth.uid()
  )
)
WITH CHECK (
  -- Allow the resulting row when actor is owner/assigned manager/finance/admin
  employee_id = auth.uid()
  OR manager_id = auth.uid()
  OR has_department_role(auth.uid(), 'finance'::app_role_new)
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
  -- Peer managers may set final status on someone else's pending ticket
  OR (
    has_employee_type(auth.uid(), 'manager'::employee_type)
    AND employee_id <> auth.uid()
  )
);