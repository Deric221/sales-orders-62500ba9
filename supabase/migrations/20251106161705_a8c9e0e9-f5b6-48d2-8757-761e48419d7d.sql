-- Add storage policies for expense-retirements bucket

-- Allow employees to upload their own retirement documents
CREATE POLICY "Employees can upload retirement documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-retirements' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view their own retirement documents
CREATE POLICY "Users can view their retirement documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-retirements' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM expense_retirements er
      JOIN expense_tickets et ON er.expense_ticket_id = et.id
      WHERE er.file_path = name
      AND (et.employee_id = auth.uid() OR et.manager_id = auth.uid() OR has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    )
  )
);

-- Allow finance and admins to view all retirement documents
CREATE POLICY "Finance can view all retirement documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-retirements'
  AND (has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);