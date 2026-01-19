-- Remove unique constraint on invoice_number to allow duplicates
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;