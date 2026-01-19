-- 1) Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
-- Anyone authenticated can read departments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'departments' AND policyname = 'Departments are readable'
  ) THEN
    CREATE POLICY "Departments are readable" ON public.departments FOR SELECT USING (true);
  END IF;
END $$;
-- Only admins can manage departments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'departments' AND policyname = 'Admins manage departments'
  ) THEN
    CREATE POLICY "Admins manage departments" ON public.departments FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 2) Make department_role optional and remove default
ALTER TABLE public.user_roles ALTER COLUMN department_role DROP NOT NULL;
ALTER TABLE public.user_roles ALTER COLUMN department_role DROP DEFAULT;

-- 3) Add department_id to user_roles and FK to departments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE public.user_roles ADD COLUMN department_id UUID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_department_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES public.departments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Ensure user_roles.user_id references profiles(id) so nested selects work
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 5) Create managerial_role enum
DO $$ BEGIN
  CREATE TYPE public.managerial_role AS ENUM (
    'director_finance',
    'director_business',
    'director_cx',
    'head_compliance'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6) Create manager_assignments table (one assignee per role)
CREATE TABLE IF NOT EXISTS public.manager_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  role public.managerial_role NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for manager_assignments
ALTER TABLE public.manager_assignments ENABLE ROW LEVEL SECURITY;
-- Admins can manage all assignments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manager_assignments' AND policyname = 'Admins manage manager assignments'
  ) THEN
    CREATE POLICY "Admins manage manager assignments" ON public.manager_assignments FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;
-- Users can view their own assignment
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manager_assignments' AND policyname = 'Users view their own manager assignment'
  ) THEN
    CREATE POLICY "Users view their own manager assignment" ON public.manager_assignments FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- 7) Update handle_new_user to avoid auto-assigning department role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  -- Create or ensure single user_roles row with default employee type only
  INSERT INTO public.user_roles (user_id, employee_type)
  VALUES (
    NEW.id,
    'employee'::employee_type
  )
  ON CONFLICT (user_id) DO UPDATE
  SET employee_type = EXCLUDED.employee_type;

  RETURN NEW;
END;
$$;