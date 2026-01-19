-- Restrict manager_assignments visibility to managers and admins only
-- This prevents exposure of organizational hierarchy to all employees

-- Drop existing public read policy
DROP POLICY IF EXISTS "Manager assignments are readable by all" ON public.manager_assignments;
DROP POLICY IF EXISTS "Users view their own manager assignment" ON public.manager_assignments;

-- Create new restricted policy for viewing manager assignments
CREATE POLICY "Managers and admins can view manager assignments"
ON public.manager_assignments
FOR SELECT
USING (
  has_employee_type(auth.uid(), 'manager'::employee_type) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);