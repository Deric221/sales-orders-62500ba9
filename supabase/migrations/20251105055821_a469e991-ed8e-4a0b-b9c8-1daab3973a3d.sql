-- Fix storage bucket upload policies to restrict by role
-- Drop overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;

-- Sales can upload quotes to their own folder
CREATE POLICY "Sales uploads quotes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (has_department_role(auth.uid(), 'sales') OR has_department_role(auth.uid(), 'admin'))
  );

-- Orders can upload POs and waybills to their own folder
CREATE POLICY "Orders uploads POs and waybills"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (has_department_role(auth.uid(), 'orders') OR has_department_role(auth.uid(), 'admin'))
  );

-- Finance can upload invoices to their own folder
CREATE POLICY "Finance uploads invoices"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (has_department_role(auth.uid(), 'finance') OR has_department_role(auth.uid(), 'admin'))
  );

-- Projects can upload documentation to their own folder
CREATE POLICY "Projects uploads documentation"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (has_department_role(auth.uid(), 'projects') OR has_department_role(auth.uid(), 'admin'))
  );

-- Fix expense_tickets INSERT policy to use correct function
DROP POLICY IF EXISTS "Employees can create their own tickets" ON public.expense_tickets;

CREATE POLICY "Employees can create their own tickets"
  ON public.expense_tickets
  FOR INSERT
  WITH CHECK (
    employee_id = auth.uid() 
    AND (has_employee_type(auth.uid(), 'employee') OR has_employee_type(auth.uid(), 'manager'))
  );