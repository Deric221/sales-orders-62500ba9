-- Add new workflow stages for project handling
ALTER TYPE public.workflow_stage ADD VALUE IF NOT EXISTS 'awaiting_project_completion';
ALTER TYPE public.workflow_stage ADD VALUE IF NOT EXISTS 'project_completed';

-- Add projects role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'projects';

-- Update the notify_next_role function to handle project-based workflows
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
  has_project boolean;
BEGIN
  -- Get quote details
  SELECT customer_name, quote_number INTO quote_customer, quote_num
  FROM quotes WHERE id = NEW.quote_id;

  -- Check if workflow has a linked project
  has_project := NEW.project_id IS NOT NULL;

  -- Determine which role to notify based on current stage
  IF NEW.current_stage = 'customer_po_uploaded' THEN
    target_role := 'orders';
  ELSIF NEW.current_stage = 'company_po_uploaded' THEN
    -- After company PO, always goes to orders for waybill
    target_role := 'orders';
  ELSIF NEW.current_stage = 'waybill_created' THEN
    -- After waybill: check if project exists
    IF has_project THEN
      -- If project exists, notify projects team
      target_role := 'projects';
    ELSE
      -- No project, go directly to finance
      target_role := 'finance';
    END IF;
  ELSIF NEW.current_stage = 'project_completed' THEN
    -- Project completed, notify finance
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