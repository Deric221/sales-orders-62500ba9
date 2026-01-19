-- Add finance_paid_by column to track who marked the expense as paid
ALTER TABLE public.expense_tickets
ADD COLUMN IF NOT EXISTS finance_paid_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.expense_tickets.finance_paid_by IS 'User who marked the ticket as paid (for auditing)';

-- Create RLS policy for finance to download retirement documents
DROP POLICY IF EXISTS "Finance can view retirement documents" ON storage.objects;

CREATE POLICY "Finance can view retirement documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'expense-retirements'
  AND (
    has_department_role(auth.uid(), 'finance'::app_role_new)
    OR has_department_role(auth.uid(), 'admin'::app_role_new)
    -- Employees can view their own retirement documents
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);