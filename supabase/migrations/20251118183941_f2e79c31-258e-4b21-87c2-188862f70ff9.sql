-- Security Fix: Restrict manager_assignments visibility to managers and admins only
-- Drop existing policies
DROP POLICY IF EXISTS "Admins manage manager assignments" ON public.manager_assignments;
DROP POLICY IF EXISTS "Managers and admins can view manager assignments" ON public.manager_assignments;
DROP POLICY IF EXISTS "Only admins can modify manager assignments" ON public.manager_assignments;

-- Create comprehensive policies
CREATE POLICY "Only admins can manage manager assignments" 
ON public.manager_assignments 
FOR ALL 
USING (has_department_role(auth.uid(), 'admin'::app_role_new));

CREATE POLICY "Managers and admins can view manager assignments" 
ON public.manager_assignments 
FOR SELECT 
USING (
  has_employee_type(auth.uid(), 'manager'::employee_type) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);