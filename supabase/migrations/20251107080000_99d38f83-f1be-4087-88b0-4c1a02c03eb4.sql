-- Update RLS policy to allow managers to view other managers' tickets
DROP POLICY IF EXISTS "Employees can view their own tickets" ON public.expense_tickets;

CREATE POLICY "Users can view their expense tickets" 
ON public.expense_tickets 
FOR SELECT 
USING (
  employee_id = auth.uid() 
  OR manager_id = auth.uid() 
  OR has_role(auth.uid(), 'finance'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    -- Managers can see pending tickets from other managers
    has_employee_type(auth.uid(), 'manager'::employee_type)
    AND status = 'pending_manager_approval'
    AND employee_id IN (
      SELECT user_id FROM user_roles WHERE employee_type = 'manager'::employee_type
    )
    AND employee_id != auth.uid()
  )
);

-- Update trigger to notify all managers when a manager submits a ticket
CREATE OR REPLACE FUNCTION public.notify_managers_on_expense_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  employee_name TEXT;
  is_manager_ticket BOOLEAN;
  manager_users UUID[];
BEGIN
  -- Only notify when status changes to pending_manager_approval
  IF NEW.status = 'pending_manager_approval' AND (TG_OP = 'INSERT' OR OLD.status != 'pending_manager_approval') THEN
    -- Get employee name
    SELECT p.full_name INTO employee_name
    FROM public.profiles p
    WHERE p.id = NEW.employee_id;
    
    -- Check if submitter is a manager
    SELECT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = NEW.employee_id 
      AND employee_type = 'manager'::employee_type
    ) INTO is_manager_ticket;
    
    IF is_manager_ticket THEN
      -- Notify ALL managers except the submitter
      SELECT array_agg(user_id) INTO manager_users
      FROM user_roles
      WHERE employee_type = 'manager'::employee_type
      AND user_id != NEW.employee_id;
      
      IF manager_users IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, related_type, related_id)
        SELECT 
          unnest(manager_users),
          'Manager Expense Ticket',
          format('Expense ticket %s from manager %s is pending approval (GHS %s)', NEW.ticket_number, COALESCE(employee_name, 'Manager'), NEW.total_amount),
          'expense_ticket',
          NEW.id;
      END IF;
    ELSE
      -- Regular employee ticket, notify assigned manager
      IF NEW.manager_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, related_type, related_id)
        VALUES (
          NEW.manager_id,
          'New Expense Ticket',
          format('Expense ticket %s from %s is pending your approval (GHS %s)', NEW.ticket_number, COALESCE(employee_name, 'Employee'), NEW.total_amount),
          'expense_ticket',
          NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS on_expense_ticket_status_change ON public.expense_tickets;

CREATE TRIGGER on_expense_ticket_status_change
AFTER INSERT OR UPDATE ON public.expense_tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_managers_on_expense_submit();