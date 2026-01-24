-- Fix: Add unique constraint on slug if missing and ensure departments are properly seeded
-- This migration handles the conflict by using DO UPDATE on name

-- First, ensure we don't have duplicate departments
DELETE FROM public.departments a
USING public.departments b
WHERE a.id > b.id 
AND a.name = b.name;

-- Add unique constraint on slug if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'departments_slug_key'
  ) THEN
    ALTER TABLE public.departments ADD CONSTRAINT departments_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Upsert departments using name as the conflict target
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
ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug;

-- Re-insert department hierarchy mappings
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