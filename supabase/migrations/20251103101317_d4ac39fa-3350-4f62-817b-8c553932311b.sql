-- Create has_employee_type function to check employee_type
CREATE OR REPLACE FUNCTION public.has_employee_type(_user_id uuid, _type employee_type)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND employee_type = _type
  )
$$;

-- Fix expense_tickets INSERT policy to use employee_type instead of department_role
DROP POLICY IF EXISTS "Employees can create their own tickets" ON expense_tickets;
CREATE POLICY "Employees can create their own tickets"
ON expense_tickets FOR INSERT
WITH CHECK (
  employee_id = auth.uid() AND 
  (has_employee_type(auth.uid(), 'employee'::employee_type) OR has_employee_type(auth.uid(), 'manager'::employee_type))
);

-- Add RLS policies for manager_assignments table
CREATE POLICY "Manager assignments are readable by all"
ON manager_assignments FOR SELECT
USING (true);

CREATE POLICY "Only admins can modify manager assignments"
ON manager_assignments FOR ALL
USING (has_department_role(auth.uid(), 'admin'::app_role_new));

-- Restrict quotes access to authorized roles only
DROP POLICY IF EXISTS "Authorized roles can view quotes" ON quotes;
CREATE POLICY "Authorized roles can view quotes"
ON quotes FOR SELECT
USING (
  has_department_role(auth.uid(), 'sales'::app_role_new) OR 
  has_department_role(auth.uid(), 'orders'::app_role_new) OR 
  has_department_role(auth.uid(), 'finance'::app_role_new) OR 
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Restrict customer_pos access
DROP POLICY IF EXISTS "Authorized roles can view customer POs" ON customer_pos;
CREATE POLICY "Authorized roles can view customer POs"
ON customer_pos FOR SELECT
USING (
  has_department_role(auth.uid(), 'sales'::app_role_new) OR 
  has_department_role(auth.uid(), 'orders'::app_role_new) OR 
  has_department_role(auth.uid(), 'finance'::app_role_new) OR 
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Restrict company_pos access
DROP POLICY IF EXISTS "Everyone can view company POs" ON company_pos;
CREATE POLICY "Authorized roles can view company POs"
ON company_pos FOR SELECT
USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR 
  has_department_role(auth.uid(), 'finance'::app_role_new) OR 
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Restrict waybills access
DROP POLICY IF EXISTS "Everyone can view waybills" ON waybills;
CREATE POLICY "Authorized roles can view waybills"
ON waybills FOR SELECT
USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR 
  has_department_role(auth.uid(), 'projects'::app_role_new) OR 
  has_department_role(auth.uid(), 'finance'::app_role_new) OR 
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Add documentation comment for user_roles INSERT policy
COMMENT ON TABLE user_roles IS 'INSERT operations are handled exclusively by the handle_new_user() SECURITY DEFINER trigger during user signup. Direct inserts by users are not permitted.';