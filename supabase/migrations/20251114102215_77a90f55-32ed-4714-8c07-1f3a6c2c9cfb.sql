-- Create function to check if user is an approving director (not finance director)
CREATE OR REPLACE FUNCTION public.is_approving_director(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.manager_assignments ma
    WHERE ma.user_id = _user_id
    AND ma.role IN ('director_business', 'director_of_technology')
  )
$$;

-- Update expense_tickets RLS policy for managers
DROP POLICY IF EXISTS "Employees and managers can update their tickets" ON public.expense_tickets;

CREATE POLICY "Employees managers and directors can update tickets"
ON public.expense_tickets
FOR UPDATE
USING (
  -- Employee can update their own ticket
  employee_id = auth.uid()
  -- Assigned manager can update
  OR manager_id = auth.uid()
  -- Finance can update (for payment)
  OR has_department_role(auth.uid(), 'finance'::app_role_new)
  -- Admin can update
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
  -- Any approving director can approve pending tickets (not finance director)
  OR (
    is_approving_director(auth.uid())
    AND status = 'pending_manager_approval'::expense_status
    AND employee_id != auth.uid()
  )
)
WITH CHECK (
  employee_id = auth.uid()
  OR manager_id = auth.uid()
  OR has_department_role(auth.uid(), 'finance'::app_role_new)
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
  OR (is_approving_director(auth.uid()) AND employee_id != auth.uid())
);

-- Update SELECT policy to allow approving directors to see pending tickets
DROP POLICY IF EXISTS "Users can view their expense tickets" ON public.expense_tickets;

CREATE POLICY "Users can view expense tickets"
ON public.expense_tickets
FOR SELECT
USING (
  employee_id = auth.uid()
  OR manager_id = auth.uid()
  OR has_role(auth.uid(), 'finance'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  -- Approving directors can see pending tickets for approval
  OR (
    is_approving_director(auth.uid())
    AND status = 'pending_manager_approval'::expense_status
    AND employee_id != auth.uid()
  )
);