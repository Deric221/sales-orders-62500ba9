-- Add currency column to expense_tickets table
ALTER TABLE public.expense_tickets 
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'GHS' CHECK (currency IN ('GHS', 'USD'));