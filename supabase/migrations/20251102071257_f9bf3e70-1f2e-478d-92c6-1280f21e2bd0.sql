-- 1) Update departments to match the organogram
DELETE FROM public.departments;
INSERT INTO public.departments (name, slug) VALUES
  ('Finance', 'finance'),
  ('HR & Admin', 'hr_admin'),
  ('Infotech', 'infotech'),
  ('HSEQ', 'hseq'),
  ('Sales', 'sales'),
  ('Marketing', 'marketing'),
  ('Orders', 'orders'),
  ('Technology', 'technology'),
  ('Support', 'support'),
  ('Learning', 'learning'),
  ('Projects', 'projects'),
  ('Legal', 'legal'),
  ('ISMS', 'isms'),
  ('QMS', 'qms');

-- 2) Create department hierarchy table to map departments to their reporting manager role
CREATE TABLE IF NOT EXISTS public.department_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  reports_to public.managerial_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(department_id)
);

-- Enable RLS
ALTER TABLE public.department_hierarchy ENABLE ROW LEVEL SECURITY;

-- Policies for department_hierarchy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'department_hierarchy' AND policyname = 'Anyone can read department hierarchy'
  ) THEN
    CREATE POLICY "Anyone can read department hierarchy" ON public.department_hierarchy FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'department_hierarchy' AND policyname = 'Admins can manage department hierarchy'
  ) THEN
    CREATE POLICY "Admins can manage department hierarchy" ON public.department_hierarchy FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 3) Populate department hierarchy based on organogram
INSERT INTO public.department_hierarchy (department_id, reports_to)
SELECT d.id, 'director_finance'::public.managerial_role
FROM public.departments d
WHERE d.slug IN ('finance', 'hr_admin', 'infotech', 'hseq')
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO public.department_hierarchy (department_id, reports_to)
SELECT d.id, 'director_business'::public.managerial_role
FROM public.departments d
WHERE d.slug IN ('sales', 'marketing', 'orders')
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO public.department_hierarchy (department_id, reports_to)
SELECT d.id, 'director_cx'::public.managerial_role
FROM public.departments d
WHERE d.slug IN ('technology', 'support', 'learning', 'projects')
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO public.department_hierarchy (department_id, reports_to)
SELECT d.id, 'head_compliance'::public.managerial_role
FROM public.departments d
WHERE d.slug IN ('legal', 'isms', 'qms')
ON CONFLICT (department_id) DO NOTHING;

-- 4) Create function to auto-assign employee to manager when department is assigned
CREATE OR REPLACE FUNCTION public.auto_assign_employee_to_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_role public.managerial_role;
  manager_user_id UUID;
BEGIN
  -- Only process if department_id is being set and employee_type is 'employee'
  IF NEW.department_id IS NOT NULL AND NEW.employee_type = 'employee' THEN
    -- Get the reporting manager role for this department
    SELECT dh.reports_to INTO manager_role
    FROM public.department_hierarchy dh
    WHERE dh.department_id = NEW.department_id;
    
    IF manager_role IS NOT NULL THEN
      -- Get the user assigned to this managerial role
      SELECT ma.user_id INTO manager_user_id
      FROM public.manager_assignments ma
      WHERE ma.role = manager_role;
      
      IF manager_user_id IS NOT NULL THEN
        -- Create or update employee-manager mapping
        INSERT INTO public.employee_manager_mapping (employee_id, manager_id)
        VALUES (NEW.user_id, manager_user_id)
        ON CONFLICT (employee_id) 
        DO UPDATE SET manager_id = manager_user_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-assignment
DROP TRIGGER IF EXISTS trigger_auto_assign_manager ON public.user_roles;
CREATE TRIGGER trigger_auto_assign_manager
  AFTER INSERT OR UPDATE OF department_id ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_employee_to_manager();

-- 5) Create notification function for expense tickets
CREATE OR REPLACE FUNCTION public.notify_manager_on_expense_submit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_name TEXT;
BEGIN
  -- Only notify when status changes to pending_manager_approval
  IF NEW.status = 'pending_manager_approval' AND (TG_OP = 'INSERT' OR OLD.status != 'pending_manager_approval') THEN
    -- Get employee name
    SELECT p.full_name INTO employee_name
    FROM public.profiles p
    WHERE p.id = NEW.employee_id;
    
    -- Create notification for the manager
    INSERT INTO public.notifications (user_id, title, message, related_type, related_id)
    VALUES (
      NEW.manager_id,
      'New Expense Ticket',
      format('Expense ticket %s from %s is pending your approval (GHS %s)', NEW.ticket_number, COALESCE(employee_name, 'Employee'), NEW.total_amount),
      'expense_ticket',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for expense notifications
DROP TRIGGER IF EXISTS trigger_notify_manager_expense ON public.expense_tickets;
CREATE TRIGGER trigger_notify_manager_expense
  AFTER INSERT OR UPDATE OF status ON public.expense_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_manager_on_expense_submit();