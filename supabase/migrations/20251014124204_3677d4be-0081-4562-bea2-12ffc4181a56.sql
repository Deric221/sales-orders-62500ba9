-- Fix critical storage and invoices security issues

-- 1) Create a function to check document access by role
CREATE OR REPLACE FUNCTION public.can_access_document(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admins can access all documents
    public.has_role(_user_id, 'admin')
    -- Users can access files uploaded by themselves (path starts with their user_id)
    OR split_part(_path, '/', 1) = _user_id::text
    -- Sales can access quote documents
    OR (
      public.has_role(_user_id, 'sales') AND EXISTS (
        SELECT 1 FROM public.quotes q WHERE q.file_path = _path
      )
    )
    -- Orders can access quotes, customer POs, and company POs
    OR (
      public.has_role(_user_id, 'orders') AND (
        EXISTS (SELECT 1 FROM public.quotes q WHERE q.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.customer_pos cpo WHERE cpo.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.company_pos cco WHERE cco.file_path = _path)
      )
    )
    -- Finance can access all document types including invoices
    OR (
      public.has_role(_user_id, 'finance') AND (
        EXISTS (SELECT 1 FROM public.invoices i WHERE i.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.customer_pos cpo WHERE cpo.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.company_pos cco WHERE cco.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.quotes q WHERE q.file_path = _path)
      )
    );
$$;

-- 2) Drop the overly permissive storage policy
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;

-- 3) Create new role-based storage policy
CREATE POLICY "Controlled access to documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents' AND public.can_access_document(auth.uid(), name)
  );

-- 4) Drop overly permissive invoices policy
DROP POLICY IF EXISTS "Everyone can view invoices" ON public.invoices;

-- 5) Create restrictive invoices policy for finance and admins only
CREATE POLICY "Finance and admins can view invoices"
  ON public.invoices
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'admin')
  );
