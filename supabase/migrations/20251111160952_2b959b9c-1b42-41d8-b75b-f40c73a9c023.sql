-- Fix 1: Update profiles RLS policy so admins can see all users including new signups
DROP POLICY IF EXISTS "Profiles are viewable by self, managers, finance, admins" ON public.profiles;

CREATE POLICY "Profiles are viewable by self, managers, finance, admins"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id
  OR has_employee_type(auth.uid(), 'manager'::employee_type)
  OR has_department_role(auth.uid(), 'finance'::app_role_new)
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Fix 2: Remove unrestricted INSERT policy on expense_audit_logs
-- The SECURITY DEFINER trigger will continue to work and is the only way to insert audit logs
DROP POLICY IF EXISTS "System can create audit logs" ON public.expense_audit_logs;