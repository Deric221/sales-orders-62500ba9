-- Create expense ticket status enum
CREATE TYPE expense_status AS ENUM (
  'draft',
  'pending_manager_approval',
  'approved',
  'rejected',
  'paid',
  'retired'
);

-- Create employee-manager mapping table
CREATE TABLE public.employee_manager_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id)
);

ALTER TABLE public.employee_manager_mapping ENABLE ROW LEVEL SECURITY;

-- Create expense tickets table
CREATE TABLE public.expense_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(10, 2) NOT NULL,
  issued_in_favour_of TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status expense_status NOT NULL DEFAULT 'draft',
  manager_notes TEXT,
  manager_approved_at TIMESTAMP WITH TIME ZONE,
  finance_paid_at TIMESTAMP WITH TIME ZONE,
  payment_details TEXT,
  digital_signature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.expense_tickets ENABLE ROW LEVEL SECURITY;

-- Create expense details table (line items)
CREATE TABLE public.expense_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_ticket_id UUID NOT NULL REFERENCES public.expense_tickets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.expense_details ENABLE ROW LEVEL SECURITY;

-- Create retirement documents table
CREATE TABLE public.expense_retirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_ticket_id UUID NOT NULL REFERENCES public.expense_tickets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

ALTER TABLE public.expense_retirements ENABLE ROW LEVEL SECURITY;

-- Create expense audit logs table
CREATE TABLE public.expense_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_ticket_id UUID NOT NULL REFERENCES public.expense_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.expense_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_manager_mapping
CREATE POLICY "Employees can view their manager"
ON public.employee_manager_mapping
FOR SELECT
USING (employee_id = auth.uid() OR manager_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage employee-manager mappings"
ON public.employee_manager_mapping
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for expense_tickets
CREATE POLICY "Employees can view their own tickets"
ON public.expense_tickets
FOR SELECT
USING (
  employee_id = auth.uid() 
  OR manager_id = auth.uid() 
  OR has_role(auth.uid(), 'finance') 
  OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Employees can create their own tickets"
ON public.expense_tickets
FOR INSERT
WITH CHECK (
  employee_id = auth.uid() 
  AND (has_role(auth.uid(), 'employee') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Employees and managers can update their tickets"
ON public.expense_tickets
FOR UPDATE
USING (
  employee_id = auth.uid() 
  OR manager_id = auth.uid() 
  OR has_role(auth.uid(), 'finance') 
  OR has_role(auth.uid(), 'admin')
);

-- RLS Policies for expense_details
CREATE POLICY "Users can view expense details of their tickets"
ON public.expense_details
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expense_tickets et
    WHERE et.id = expense_ticket_id
    AND (et.employee_id = auth.uid() OR et.manager_id = auth.uid() OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Employees can manage details of their tickets"
ON public.expense_details
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.expense_tickets et
    WHERE et.id = expense_ticket_id
    AND et.employee_id = auth.uid()
  )
);

-- RLS Policies for expense_retirements
CREATE POLICY "Users can view retirements of their tickets"
ON public.expense_retirements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expense_tickets et
    WHERE et.id = expense_ticket_id
    AND (et.employee_id = auth.uid() OR et.manager_id = auth.uid() OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Employees can upload retirement documents"
ON public.expense_retirements
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.expense_tickets et
    WHERE et.id = expense_ticket_id
    AND et.employee_id = auth.uid()
    AND et.status = 'paid'
  )
);

-- RLS Policies for expense_audit_logs
CREATE POLICY "Users can view audit logs of their tickets"
ON public.expense_audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expense_tickets et
    WHERE et.id = expense_ticket_id
    AND (et.employee_id = auth.uid() OR et.manager_id = auth.uid() OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "System can create audit logs"
ON public.expense_audit_logs
FOR INSERT
WITH CHECK (true);

-- Trigger to update updated_at on expense_tickets
CREATE TRIGGER update_expense_tickets_updated_at
BEFORE UPDATE ON public.expense_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION public.log_expense_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  INSERT INTO public.expense_audit_logs (expense_ticket_id, user_id, action, details)
  VALUES (
    NEW.id,
    auth.uid(),
    TG_OP,
    jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;

-- Trigger for audit logging
CREATE TRIGGER expense_ticket_audit_log
AFTER INSERT OR UPDATE ON public.expense_tickets
FOR EACH ROW
EXECUTE FUNCTION public.log_expense_action();

-- Create storage bucket for retirement documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-retirements', 'expense-retirements', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for retirement documents
CREATE POLICY "Users can view retirement docs of their tickets"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'expense-retirements'
  AND (
    EXISTS (
      SELECT 1 FROM public.expense_retirements er
      JOIN public.expense_tickets et ON et.id = er.expense_ticket_id
      WHERE er.file_path = name
      AND (et.employee_id = auth.uid() OR et.manager_id = auth.uid() OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'admin'))
    )
  )
);

CREATE POLICY "Employees can upload retirement documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'expense-retirements'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Function to generate expense ticket number
CREATE OR REPLACE FUNCTION public.generate_expense_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
  ticket_num TEXT;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(ticket_number FROM 'EXP-' || current_year || '-([0-9]+)') AS INTEGER)
  ), 0) + 1
  INTO next_number
  FROM public.expense_tickets
  WHERE ticket_number LIKE 'EXP-' || current_year || '-%';
  
  ticket_num := 'EXP-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN ticket_num;
END;
$$;