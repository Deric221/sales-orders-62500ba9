-- Fix the ticket number generation function to handle concurrent submissions
CREATE OR REPLACE FUNCTION public.generate_expense_ticket_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  ticket_num TEXT;
  current_year TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  LOOP
    -- Get the next number with proper locking
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(ticket_number FROM 'EXP-' || current_year || '-([0-9]+)') AS INTEGER)
    ), 0) + 1
    INTO next_number
    FROM public.expense_tickets
    WHERE ticket_number LIKE 'EXP-' || current_year || '-%'
    FOR UPDATE;
    
    ticket_num := 'EXP-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
    
    -- Check if this ticket number already exists
    IF NOT EXISTS (SELECT 1 FROM public.expense_tickets WHERE ticket_number = ticket_num) THEN
      RETURN ticket_num;
    END IF;
    
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique ticket number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$function$;

-- Add tables for distributor quotes and invoices
CREATE TABLE IF NOT EXISTS public.distributor_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_po_id UUID NOT NULL REFERENCES public.company_pos(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.distributor_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_po_id UUID NOT NULL REFERENCES public.company_pos(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.distributor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for distributor quotes
CREATE POLICY "Orders and Finance can view distributor quotes"
ON public.distributor_quotes
FOR SELECT
USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR
  has_department_role(auth.uid(), 'finance'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can create distributor quotes"
ON public.distributor_quotes
FOR INSERT
WITH CHECK (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- RLS policies for distributor invoices
CREATE POLICY "Orders and Finance can view distributor invoices"
ON public.distributor_invoices
FOR SELECT
USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR
  has_department_role(auth.uid(), 'finance'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can create distributor invoices"
ON public.distributor_invoices
FOR INSERT
WITH CHECK (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Add triggers for updated_at
CREATE TRIGGER update_distributor_quotes_updated_at
BEFORE UPDATE ON public.distributor_quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_distributor_invoices_updated_at
BEFORE UPDATE ON public.distributor_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();