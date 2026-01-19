-- Add database constraints for expense amounts validation
-- This provides server-side validation for financial data

-- Add check constraint for positive amounts on expense_tickets
ALTER TABLE public.expense_tickets 
ADD CONSTRAINT expense_tickets_total_amount_positive CHECK (total_amount > 0);

ALTER TABLE public.expense_tickets 
ADD CONSTRAINT expense_tickets_amount_requested_positive CHECK (amount_requested IS NULL OR amount_requested > 0);

ALTER TABLE public.expense_tickets 
ADD CONSTRAINT expense_tickets_actual_amount_positive CHECK (actual_amount_spent IS NULL OR actual_amount_spent >= 0);

-- Add check constraint for positive amounts on expense_details
ALTER TABLE public.expense_details 
ADD CONSTRAINT expense_details_amount_positive CHECK (amount > 0);

-- Add check constraint for valid currency codes
ALTER TABLE public.expense_tickets 
ADD CONSTRAINT expense_tickets_valid_currency CHECK (currency IN ('GHS', 'USD'));

-- Add reasonable upper limit to prevent extreme values
ALTER TABLE public.expense_tickets 
ADD CONSTRAINT expense_tickets_amount_limit CHECK (total_amount <= 10000000);

ALTER TABLE public.expense_details 
ADD CONSTRAINT expense_details_amount_limit CHECK (amount <= 10000000);