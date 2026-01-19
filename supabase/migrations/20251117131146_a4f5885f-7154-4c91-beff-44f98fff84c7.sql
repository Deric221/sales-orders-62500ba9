-- Allow managers to view pending tickets across departments and add storage policies for retirement docs

-- 1) Update expense_tickets SELECT policy to allow all managers to view all pending tickets
DROP POLICY IF EXISTS "Users can view expense tickets" ON public.expense_tickets;
CREATE POLICY "Users can view expense tickets"
ON public.expense_tickets
FOR SELECT
USING (
  (employee_id = auth.uid())
  OR (manager_id = auth.uid())
  OR has_role(auth.uid(), 'finance'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    is_approving_director(auth.uid())
    AND status = 'pending_manager_approval'::expense_status
    AND employee_id <> auth.uid()
  )
  OR (
    has_employee_type(auth.uid(), 'manager'::employee_type)
    AND status = 'pending_manager_approval'::expense_status
    AND employee_id <> auth.uid()
  )
);

-- 2) Storage policies for expense-retirements bucket
-- Drop existing policies if any
DROP POLICY IF EXISTS "View expense retirement docs" ON storage.objects;
DROP POLICY IF EXISTS "Upload own expense retirement docs" ON storage.objects;

-- View: uploader, finance, admin, and assigned manager can read
CREATE POLICY "View expense retirement docs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'expense-retirements' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_department_role(auth.uid(), 'finance'::app_role_new)
    OR has_department_role(auth.uid(), 'admin'::app_role_new)
    OR EXISTS (
      SELECT 1
      FROM public.expense_retirements er
      JOIN public.expense_tickets et ON et.id = er.expense_ticket_id
      WHERE er.file_path = name AND et.manager_id = auth.uid()
    )
  )
);

-- Insert: only allow uploading to own user folder in expense-retirements bucket
CREATE POLICY "Upload own expense retirement docs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'expense-retirements'
  AND auth.uid()::text = (storage.foldername(name))[1]
);