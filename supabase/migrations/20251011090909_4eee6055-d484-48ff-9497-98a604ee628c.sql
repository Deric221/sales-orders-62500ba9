-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'sales', 'orders', 'finance');

-- Create enum for workflow stages
CREATE TYPE public.workflow_stage AS ENUM (
  'quote_uploaded',
  'customer_po_uploaded', 
  'company_po_uploaded',
  'waybill_created',
  'invoice_generated',
  'completed'
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create quotes table
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create customer_pos table
CREATE TABLE public.customer_pos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  po_number TEXT UNIQUE NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create company_pos table
CREATE TABLE public.company_pos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_po_id UUID REFERENCES public.customer_pos(id) ON DELETE CASCADE NOT NULL,
  po_number TEXT UNIQUE NOT NULL,
  distributor_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create waybills table
CREATE TABLE public.waybills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_po_id UUID REFERENCES public.company_pos(id) ON DELETE CASCADE NOT NULL,
  waybill_number TEXT UNIQUE NOT NULL,
  product_details TEXT,
  serial_numbers TEXT[],
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) NOT NULL,
  customer_po_id UUID REFERENCES public.customer_pos(id) NOT NULL,
  company_po_id UUID REFERENCES public.company_pos(id) NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  file_path TEXT,
  file_name TEXT,
  generated_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  related_type TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow_tracker table
CREATE TABLE public.workflow_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_stage workflow_stage NOT NULL DEFAULT 'quote_uploaded',
  customer_po_id UUID REFERENCES public.customer_pos(id),
  company_po_id UUID REFERENCES public.company_pos(id),
  invoice_id UUID REFERENCES public.invoices(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waybills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_tracker ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for quotes
CREATE POLICY "Sales can create quotes"
  ON public.quotes FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view quotes"
  ON public.quotes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sales can update their quotes"
  ON public.quotes FOR UPDATE
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for customer_pos
CREATE POLICY "Sales can create customer POs"
  ON public.customer_pos FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view customer POs"
  ON public.customer_pos FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for company_pos
CREATE POLICY "Orders can create company POs"
  ON public.company_pos FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'orders') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view company POs"
  ON public.company_pos FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for waybills
CREATE POLICY "Orders can manage waybills"
  ON public.waybills FOR ALL
  USING (public.has_role(auth.uid(), 'orders') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view waybills"
  ON public.waybills FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for invoices
CREATE POLICY "Finance can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for notifications
CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can create audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- RLS Policies for workflow_tracker
CREATE POLICY "Everyone can view workflow"
  ON public.workflow_tracker FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage workflow"
  ON public.workflow_tracker FOR ALL
  USING (true);

-- Create trigger function for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_pos_updated_at BEFORE UPDATE ON public.customer_pos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_pos_updated_at BEFORE UPDATE ON public.company_pos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_waybills_updated_at BEFORE UPDATE ON public.waybills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_tracker_updated_at BEFORE UPDATE ON public.workflow_tracker
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies for documents bucket
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Document owners can delete their documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_quotes_uploaded_by ON public.quotes(uploaded_by);
CREATE INDEX idx_customer_pos_quote_id ON public.customer_pos(quote_id);
CREATE INDEX idx_company_pos_customer_po_id ON public.company_pos(customer_po_id);
CREATE INDEX idx_waybills_company_po_id ON public.waybills(company_po_id);
CREATE INDEX idx_invoices_quote_id ON public.invoices(quote_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_workflow_tracker_quote_id ON public.workflow_tracker(quote_id);