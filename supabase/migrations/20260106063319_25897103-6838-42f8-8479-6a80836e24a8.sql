-- Allow distributor quotes to be linked to Customer PO (before Company PO exists)
-- Make company_po_id nullable and add customer_po_id

-- Add customer_po_id column to distributor_quotes
ALTER TABLE public.distributor_quotes 
ADD COLUMN customer_po_id UUID REFERENCES public.customer_pos(id);

-- Make company_po_id nullable
ALTER TABLE public.distributor_quotes 
ALTER COLUMN company_po_id DROP NOT NULL;

-- Add a check constraint to ensure at least one reference exists
ALTER TABLE public.distributor_quotes 
ADD CONSTRAINT distributor_quotes_has_reference 
CHECK (company_po_id IS NOT NULL OR customer_po_id IS NOT NULL);

-- Add index for customer_po_id lookups
CREATE INDEX idx_distributor_quotes_customer_po_id ON public.distributor_quotes(customer_po_id);