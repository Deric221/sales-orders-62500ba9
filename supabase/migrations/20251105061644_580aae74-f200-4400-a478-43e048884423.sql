-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Employees can upload retirement documents" ON storage.objects;

-- Create a stricter policy that verifies ticket ownership
CREATE POLICY "Employees upload retirement for owned paid tickets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'expense-retirements'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.expense_tickets
    WHERE id::text = split_part((storage.objects.name), '/', 2)
    AND employee_id = auth.uid()
    AND status = 'paid'
  )
);