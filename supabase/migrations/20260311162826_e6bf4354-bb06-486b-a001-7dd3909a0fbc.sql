
-- Create customers table for sales team
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers" ON public.customers
  FOR SELECT TO public USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sales and admin can create customers" ON public.customers
  FOR INSERT TO public WITH CHECK (
    has_department_role(auth.uid(), 'sales'::app_role_new) OR 
    has_department_role(auth.uid(), 'admin'::app_role_new)
  );

CREATE POLICY "Sales and admin can update customers" ON public.customers
  FOR UPDATE TO public USING (
    has_department_role(auth.uid(), 'sales'::app_role_new) OR 
    has_department_role(auth.uid(), 'admin'::app_role_new)
  );

-- Create distributors table for orders team
CREATE TABLE public.distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view distributors" ON public.distributors
  FOR SELECT TO public USING (auth.uid() IS NOT NULL);

CREATE POLICY "Orders and admin can create distributors" ON public.distributors
  FOR INSERT TO public WITH CHECK (
    has_department_role(auth.uid(), 'orders'::app_role_new) OR 
    has_department_role(auth.uid(), 'admin'::app_role_new)
  );

CREATE POLICY "Orders and admin can update distributors" ON public.distributors
  FOR UPDATE TO public USING (
    has_department_role(auth.uid(), 'orders'::app_role_new) OR 
    has_department_role(auth.uid(), 'admin'::app_role_new)
  );

-- Add comments and invoice_type to invoices table for flexible invoicing
ALTER TABLE public.invoices ADD COLUMN comments text;
ALTER TABLE public.invoices ADD COLUMN invoice_type text NOT NULL DEFAULT 'full';
