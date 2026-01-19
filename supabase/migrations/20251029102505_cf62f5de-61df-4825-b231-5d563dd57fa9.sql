-- Add server-side validation for expense amounts
-- This prevents negative amounts and ensures data integrity

-- Add CHECK constraint to expense_tickets to ensure positive total amounts
ALTER TABLE expense_tickets 
ADD CONSTRAINT positive_total_amount CHECK (total_amount > 0);

-- Add CHECK constraint to expense_details to ensure positive amounts
ALTER TABLE expense_details 
ADD CONSTRAINT positive_amount CHECK (amount > 0);

-- Add reasonable maximum constraints based on business rules (1 million limit)
ALTER TABLE expense_tickets 
ADD CONSTRAINT reasonable_total_amount CHECK (total_amount <= 1000000);

ALTER TABLE expense_details 
ADD CONSTRAINT reasonable_amount CHECK (amount <= 1000000);