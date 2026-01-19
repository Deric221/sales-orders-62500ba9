-- Add director_of_technology to managerial_role enum
ALTER TYPE managerial_role ADD VALUE IF NOT EXISTS 'director_of_technology';

-- Add fields to expense_tickets table
ALTER TABLE public.expense_tickets
ADD COLUMN IF NOT EXISTS has_receipt boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS payment_acknowledged boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_acknowledged_at timestamp with time zone;