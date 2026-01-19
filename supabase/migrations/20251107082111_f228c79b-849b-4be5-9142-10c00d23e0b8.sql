-- Fix the notification trigger to handle null user_ids properly
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
      -- Filter out null values and only aggregate if there are valid user_ids
      SELECT array_agg(user_id) INTO manager_users
      FROM user_roles
      WHERE employee_type = 'manager'::employee_type
      AND user_id != NEW.employee_id
      AND user_id IS NOT NULL;
      
      -- Only insert notifications if we have valid manager users
      IF manager_users IS NOT NULL AND array_length(manager_users, 1) > 0 THEN
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