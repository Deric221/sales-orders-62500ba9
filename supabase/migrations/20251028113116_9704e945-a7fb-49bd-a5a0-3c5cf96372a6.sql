-- Remove the old 'role' column and keep only department_role
-- First, ensure department_role has data from role where needed
UPDATE user_roles 
SET department_role = role::text::app_role_new 
WHERE department_role IS NULL AND role IS NOT NULL;

-- Update the has_role function to only check department_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND department_role::text = _role::text
  )
$$;

-- Drop the old role column
ALTER TABLE user_roles DROP COLUMN IF EXISTS role;

-- Make department_role NOT NULL since it's now the only role column
ALTER TABLE user_roles ALTER COLUMN department_role SET NOT NULL;

-- Set default value for department_role
ALTER TABLE user_roles ALTER COLUMN department_role SET DEFAULT 'sales'::app_role_new;