-- Step 1: Create new types (check if they exist first)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_type') THEN
    CREATE TYPE public.employee_type AS ENUM ('employee', 'manager');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role_new') THEN
    CREATE TYPE public.app_role_new AS ENUM ('admin', 'sales', 'orders', 'finance', 'projects');
  END IF;
END $$;

-- Step 2: Add new columns to user_roles if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_roles' AND column_name='employee_type') THEN
    ALTER TABLE public.user_roles ADD COLUMN employee_type public.employee_type;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_roles' AND column_name='department_role') THEN
    ALTER TABLE public.user_roles ADD COLUMN department_role public.app_role_new;
  END IF;
END $$;

-- Step 3: Create a temp table to consolidate roles per user
CREATE TEMP TABLE consolidated_roles AS
SELECT 
  user_id,
  MAX(CASE WHEN role::text IN ('employee', 'manager') THEN role::text END) as emp_type,
  MAX(CASE WHEN role::text IN ('admin', 'sales', 'orders', 'finance', 'projects') THEN role::text END) as dept_role,
  MIN(created_at) as first_created
FROM public.user_roles
GROUP BY user_id;

-- Step 4: Update existing rows with consolidated data
UPDATE public.user_roles ur
SET 
  employee_type = COALESCE(cr.emp_type::employee_type, 'employee'::employee_type),
  department_role = cr.dept_role::app_role_new
FROM consolidated_roles cr
WHERE ur.user_id = cr.user_id;

-- Step 5: Delete duplicate rows, keeping only the first one created per user
DELETE FROM public.user_roles a
USING public.user_roles b, consolidated_roles cr
WHERE a.user_id = b.user_id 
  AND a.user_id = cr.user_id
  AND a.created_at > cr.first_created;

-- Step 6: Make employee_type required and add unique constraint
ALTER TABLE public.user_roles 
  ALTER COLUMN employee_type SET NOT NULL,
  ALTER COLUMN employee_type SET DEFAULT 'employee'::employee_type;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- Step 7: Create helper functions
CREATE OR REPLACE FUNCTION public.has_department_role(_user_id uuid, _role app_role_new)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND department_role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_employee_type(_user_id uuid, _type employee_type)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND employee_type = _type
  )
$$;

-- Step 8: Update has_role to support both old and new columns during transition
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND (
      role = _role OR 
      department_role::text = _role::text
    )
  )
$$;