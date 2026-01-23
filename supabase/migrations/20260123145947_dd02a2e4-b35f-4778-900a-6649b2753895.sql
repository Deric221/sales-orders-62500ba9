-- Fix for local deployment: Ensure departments are inserted idempotently
-- This handles the case where departments already exist with the same name

-- Delete the problematic departments first if they exist but have different slugs
-- We do this safely to avoid foreign key issues
DO $$
BEGIN
  -- Update any existing departments to have consistent slugs
  UPDATE public.departments SET slug = 'sales' WHERE name = 'Sales';
  UPDATE public.departments SET slug = 'orders' WHERE name = 'Orders';
  UPDATE public.departments SET slug = 'finance' WHERE name = 'Finance';
  UPDATE public.departments SET slug = 'projects' WHERE name = 'Projects';
  UPDATE public.departments SET slug = 'admin' WHERE name = 'Admin';
  UPDATE public.departments SET slug = 'data-services' WHERE name = 'Data Services';
  UPDATE public.departments SET slug = 'hr-admin' WHERE name = 'HR & Admin';
  UPDATE public.departments SET slug = 'infotech' WHERE name = 'Infotech';
  UPDATE public.departments SET slug = 'compliance' WHERE name = 'Compliance';
  UPDATE public.departments SET slug = 'marketing' WHERE name = 'Marketing';
END $$;

-- Add storage policy for signed waybill uploads by orders team
-- The issue is the path starts with 'signed-waybills' not the user_id
DROP POLICY IF EXISTS "Orders can upload signed waybills" ON storage.objects;
CREATE POLICY "Orders can upload signed waybills"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'signed-waybills'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (
    has_department_role(auth.uid(), 'orders'::app_role_new) 
    OR has_department_role(auth.uid(), 'admin'::app_role_new)
  )
);