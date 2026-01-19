-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create notification trigger function
CREATE OR REPLACE FUNCTION public.notify_next_role()
RETURNS TRIGGER
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

-- Create trigger on workflow_tracker
DROP TRIGGER IF EXISTS notify_on_workflow_update ON workflow_tracker;
CREATE TRIGGER notify_on_workflow_update
AFTER UPDATE ON workflow_tracker
FOR EACH ROW
WHEN (OLD.current_stage IS DISTINCT FROM NEW.current_stage)
EXECUTE FUNCTION notify_next_role();