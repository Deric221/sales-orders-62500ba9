-- Fix search_path warning for notify_next_role function
-- This function was missing explicit search_path setting

CREATE OR REPLACE FUNCTION public.notify_next_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role app_role;
  target_users uuid[];
  quote_customer text;
  quote_num text;
BEGIN
  -- Get quote details
  SELECT customer_name, quote_number INTO quote_customer, quote_num
  FROM quotes WHERE id = NEW.quote_id;

  -- Determine which role to notify based on current stage
  IF NEW.current_stage = 'customer_po_uploaded' THEN
    target_role := 'orders';
  ELSIF NEW.current_stage = 'company_po_uploaded' THEN
    target_role := 'finance';
  ELSE
    RETURN NEW;
  END IF;

  -- Get all users with target role
  SELECT array_agg(user_id) INTO target_users
  FROM user_roles
  WHERE role = target_role;

  -- Create notifications for each user
  IF target_users IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, related_type, related_id)
    SELECT 
      unnest(target_users),
      'New Task Available',
      format('Quote %s for %s is ready for %s team processing', quote_num, quote_customer, target_role),
      'workflow',
      NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
