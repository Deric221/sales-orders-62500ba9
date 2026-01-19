-- Fix handle_new_user function to use correct column names

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  -- Insert default role (use department_role column, not role)
  INSERT INTO public.user_roles (user_id, department_role, employee_type)
  VALUES (
    NEW.id,
    'sales'::app_role_new,
    'employee'::employee_type
  )
  ON CONFLICT (user_id) DO UPDATE
  SET department_role = EXCLUDED.department_role,
      employee_type = EXCLUDED.employee_type;

  RETURN NEW;
END;
$$;