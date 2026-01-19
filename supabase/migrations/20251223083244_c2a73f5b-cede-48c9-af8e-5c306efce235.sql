-- Drop existing INSERT policy for distributor_quotes
DROP POLICY IF EXISTS "Orders can create distributor quotes" ON public.distributor_quotes;

-- Create new INSERT policy that allows both Orders and Sales to create distributor quotes
CREATE POLICY "Orders and Sales can create distributor quotes" 
ON public.distributor_quotes 
FOR INSERT 
WITH CHECK (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR 
  has_department_role(auth.uid(), 'sales'::app_role_new) OR 
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Update SELECT policy to include Sales
DROP POLICY IF EXISTS "Orders and Finance can view distributor quotes" ON public.distributor_quotes;

CREATE POLICY "Orders Finance and Sales can view distributor quotes" 
ON public.distributor_quotes 
FOR SELECT 
USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR 
  has_department_role(auth.uid(), 'finance'::app_role_new) OR 
  has_department_role(auth.uid(), 'sales'::app_role_new) OR 
  has_department_role(auth.uid(), 'admin'::app_role_new)
);