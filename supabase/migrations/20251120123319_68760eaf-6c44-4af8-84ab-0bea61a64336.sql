-- Fix invoice RLS policies to use new department role system
DROP POLICY IF EXISTS "Finance and admins can view invoices" ON invoices;
DROP POLICY IF EXISTS "Finance can create invoices" ON invoices;

-- Create updated policies using has_department_role
CREATE POLICY "Finance and admins can view invoices"
ON invoices
FOR SELECT
TO public
USING (
  has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Finance can create invoices"
ON invoices
FOR INSERT
TO public
WITH CHECK (
  has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);