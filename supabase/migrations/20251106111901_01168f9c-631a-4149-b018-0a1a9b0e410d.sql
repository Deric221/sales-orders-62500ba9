-- Fix expense ticket number generation to avoid SELECT FOR UPDATE with aggregate
-- 1) Create a global sequence for expense tickets
CREATE SEQUENCE IF NOT EXISTS public.expense_ticket_seq;

-- 2) Replace the generator function to use the sequence (safe for concurrency)
CREATE OR REPLACE FUNCTION public.generate_expense_ticket_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  seq BIGINT;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  seq := nextval('public.expense_ticket_seq');
  RETURN 'EXP-' || current_year || '-' || LPAD(seq::TEXT, 6, '0');
END;
$$;

-- Note: Frontend still calls rpc('generate_expense_ticket_number'), now backed by sequence.
