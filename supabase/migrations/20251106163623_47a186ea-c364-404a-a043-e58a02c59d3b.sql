-- Add DELETE policy for expense_tickets table to allow admins to delete tickets
CREATE POLICY "Admins can delete expense tickets"
ON public.expense_tickets
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));