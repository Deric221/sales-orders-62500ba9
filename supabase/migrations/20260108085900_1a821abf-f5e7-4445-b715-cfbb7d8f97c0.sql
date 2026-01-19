-- Drop the generated column constraint on remaining_balance to allow normal updates
-- First check if remaining_balance has a generated expression and remove it
DO $$
BEGIN
  -- Drop the generated expression by altering the column
  -- remaining_balance should be a regular column, not a generated one
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' 
    AND c.relname = 'expense_tickets' 
    AND a.attname = 'remaining_balance'
    AND a.attgenerated != ''
  ) THEN
    -- Need to drop and recreate the column as non-generated
    ALTER TABLE public.expense_tickets DROP COLUMN remaining_balance;
    ALTER TABLE public.expense_tickets ADD COLUMN remaining_balance numeric;
  END IF;
END $$;

-- Ensure remaining_balance is a regular nullable numeric column
-- Add a check constraint to ensure it's not negative (refund can't exceed requested amount)
ALTER TABLE public.expense_tickets 
  DROP CONSTRAINT IF EXISTS expense_tickets_remaining_balance_valid;

ALTER TABLE public.expense_tickets 
  ADD CONSTRAINT expense_tickets_remaining_balance_valid 
  CHECK (remaining_balance IS NULL OR remaining_balance >= 0);