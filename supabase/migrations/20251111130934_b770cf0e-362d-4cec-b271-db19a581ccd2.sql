-- Update profiles RLS policy to allow admins to see all profiles
DROP POLICY IF EXISTS "Profiles are viewable by self, managers, finance, admins" ON public.profiles;

CREATE POLICY "Profiles are viewable by self, managers, finance, admins"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR has_employee_type(auth.uid(), 'manager'::employee_type) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
  OR EXISTS (
    -- Allow viewing all profiles if the requesting user has admin department role
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND department_role = 'admin'::app_role_new
  )
);