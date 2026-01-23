-- Insert all departments (existing workflow ones + new ones)
INSERT INTO public.departments (name, slug) VALUES
  ('Sales', 'sales'),
  ('Orders', 'orders'),
  ('Finance', 'finance'),
  ('Projects', 'projects'),
  ('Admin', 'admin'),
  ('Data Services', 'data-services'),
  ('HR & Admin', 'hr-admin'),
  ('Infotech', 'infotech'),
  ('Compliance', 'compliance')
ON CONFLICT (slug) DO NOTHING;

-- Create user_department_assignments table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.user_department_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- Enable RLS
ALTER TABLE public.user_department_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_department_assignments
CREATE POLICY "Admins can manage user department assignments"
  ON public.user_department_assignments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own department assignments"
  ON public.user_department_assignments
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view department assignments"
  ON public.user_department_assignments
  FOR SELECT
  USING (has_employee_type(auth.uid(), 'manager'::employee_type));

-- Set up department hierarchy for expense approval routing
INSERT INTO public.department_hierarchy (department_id, reports_to)
SELECT d.id, 'director_business'::managerial_role
FROM public.departments d
WHERE d.slug IN ('sales', 'orders', 'data-services')
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO public.department_hierarchy (department_id, reports_to)
SELECT d.id, 'director_finance'::managerial_role
FROM public.departments d
WHERE d.slug IN ('finance')
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO public.department_hierarchy (department_id, reports_to)
SELECT d.id, 'director_of_technology'::managerial_role
FROM public.departments d
WHERE d.slug IN ('infotech', 'projects')
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO public.department_hierarchy (department_id, reports_to)
SELECT d.id, 'director_cx'::managerial_role
FROM public.departments d
WHERE d.slug IN ('hr-admin', 'admin')
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO public.department_hierarchy (department_id, reports_to)
SELECT d.id, 'head_compliance'::managerial_role
FROM public.departments d
WHERE d.slug IN ('compliance')
ON CONFLICT (department_id) DO NOTHING;

-- Update the auto_assign_employee_to_manager function to handle multiple departments
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
      WHERE ma.role = manager_role
      LIMIT 1;
      
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