-- Fix search_path for database functions to prevent search path manipulation attacks

-- Update generate_expense_ticket_number function
CREATE OR REPLACE FUNCTION public.generate_expense_ticket_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  next_number INTEGER;
  ticket_num TEXT;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(ticket_number FROM 'EXP-' || current_year || '-([0-9]+)') AS INTEGER)
  ), 0) + 1
  INTO next_number
  FROM public.expense_tickets
  WHERE ticket_number LIKE 'EXP-' || current_year || '-%';
  
  ticket_num := 'EXP-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN ticket_num;
END;
$function$;

-- Update log_expense_action function
CREATE OR REPLACE FUNCTION public.log_expense_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.expense_audit_logs (expense_ticket_id, user_id, action, details)
  VALUES (
    NEW.id,
    auth.uid(),
    TG_OP,
    jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$function$;