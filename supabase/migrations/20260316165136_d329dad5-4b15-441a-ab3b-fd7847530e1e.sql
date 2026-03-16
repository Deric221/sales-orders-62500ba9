-- Fix overly permissive storage upload policy
-- Drop the existing permissive upload policy
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;

-- Create role-based upload policy
CREATE POLICY "Role-based document uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Users can upload to their own folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Admins can upload anywhere
    has_department_role(auth.uid(), 'admin'::app_role_new)
  )
);

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;