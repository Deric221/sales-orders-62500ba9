-- Fix for local deployment: Handle existing departments from older migrations
-- This migration ensures idempotent department setup

-- First, update any existing 'HR & Admin' department to use the correct slug if it exists with old slug
UPDATE public.departments 
SET slug = 'hr-admin' 
WHERE name = 'HR & Admin' AND slug = 'hr_admin';

-- Remove duplicate/outdated departments that are no longer needed
DELETE FROM public.departments 
WHERE slug IN ('hseq', 'technology', 'support', 'learning', 'marketing')
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.department_id = departments.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.user_department_assignments uda WHERE uda.department_id = departments.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.department_hierarchy dh WHERE dh.department_id = departments.id
);

-- Re-add Marketing department (needed per user specs)
INSERT INTO public.departments (name, slug) 
VALUES ('Marketing', 'marketing')
ON CONFLICT (name) DO NOTHING;

-- Ensure department_hierarchy entry for Marketing exists
INSERT INTO public.department_hierarchy (department_id, reports_to)
SELECT d.id, 'director_business'::managerial_role
FROM public.departments d
WHERE d.slug = 'marketing'
ON CONFLICT (department_id) DO UPDATE SET reports_to = 'director_business'::managerial_role;