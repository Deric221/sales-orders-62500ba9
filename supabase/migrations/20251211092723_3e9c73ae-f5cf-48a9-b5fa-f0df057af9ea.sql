-- Update can_access_document function to allow Finance to access waybills, distributor quotes, and distributor invoices
CREATE OR REPLACE FUNCTION public.can_access_document(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE sql
STABLE
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
    -- Orders can access quotes, customer POs, company POs, waybills, distributor quotes, and distributor invoices
    OR (
      public.has_role(_user_id, 'orders') AND (
        EXISTS (SELECT 1 FROM public.quotes q WHERE q.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.customer_pos cpo WHERE cpo.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.company_pos cco WHERE cco.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.waybills w WHERE w.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.distributor_quotes dq WHERE dq.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.distributor_invoices di WHERE di.file_path = _path)
      )
    )
    -- Finance can access all document types including waybills, distributor quotes, and distributor invoices
    OR (
      public.has_role(_user_id, 'finance') AND (
        EXISTS (SELECT 1 FROM public.invoices i WHERE i.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.customer_pos cpo WHERE cpo.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.company_pos cco WHERE cco.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.quotes q WHERE q.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.waybills w WHERE w.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.distributor_quotes dq WHERE dq.file_path = _path)
        OR EXISTS (SELECT 1 FROM public.distributor_invoices di WHERE di.file_path = _path)
      )
    )
    -- Projects can access project documentation
    OR (
      public.has_role(_user_id, 'projects') AND EXISTS (
        SELECT 1 FROM public.projects p WHERE p.documentation_path = _path
      )
    );
$$;