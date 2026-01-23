-- ============================================
-- COMPLETE DATABASE RESET
-- WARNING: This deletes ALL data
-- ============================================

-- Drop all triggers first
DROP TRIGGER IF EXISTS on_expense_ticket_change ON public.expense_tickets;
DROP TRIGGER IF EXISTS on_expense_submit ON public.expense_tickets;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_workflow_on_customer_po_trigger ON public.customer_pos;
DROP TRIGGER IF EXISTS update_workflow_on_company_po_trigger ON public.company_pos;
DROP TRIGGER IF EXISTS update_workflow_on_waybill_trigger ON public.waybills;
DROP TRIGGER IF EXISTS update_workflow_on_invoice_trigger ON public.invoices;
DROP TRIGGER IF EXISTS update_workflow_on_project_trigger ON public.projects;
DROP TRIGGER IF EXISTS update_workflow_on_project_complete_trigger ON public.projects;
DROP TRIGGER IF EXISTS update_waybill_item_received_trigger ON public.delivery_items;
DROP TRIGGER IF EXISTS update_waybill_delivery_status_trigger ON public.waybill_items;

-- Drop all storage policies
DROP POLICY IF EXISTS "Orders can upload signed waybills" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload expense retirements" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their expense retirement files" ON storage.objects;

-- Drop all tables (in reverse dependency order)
DROP TABLE IF EXISTS public.expense_audit_logs CASCADE;
DROP TABLE IF EXISTS public.expense_retirements CASCADE;
DROP TABLE IF EXISTS public.expense_details CASCADE;
DROP TABLE IF EXISTS public.expense_tickets CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.delivery_items CASCADE;
DROP TABLE IF EXISTS public.delivery_records CASCADE;
DROP TABLE IF EXISTS public.waybill_items CASCADE;
DROP TABLE IF EXISTS public.waybills CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.workflow_tracker CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.distributor_invoices CASCADE;
DROP TABLE IF EXISTS public.distributor_quotes CASCADE;
DROP TABLE IF EXISTS public.company_pos CASCADE;
DROP TABLE IF EXISTS public.customer_pos CASCADE;
DROP TABLE IF EXISTS public.quotes CASCADE;
DROP TABLE IF EXISTS public.employee_manager_mapping CASCADE;
DROP TABLE IF EXISTS public.manager_assignments CASCADE;
DROP TABLE IF EXISTS public.department_hierarchy CASCADE;
DROP TABLE IF EXISTS public.user_department_assignments CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS public.expense_ticket_seq;

-- Drop all custom types (if they exist)
DROP TYPE IF EXISTS public.workflow_stage CASCADE;
DROP TYPE IF EXISTS public.expense_status CASCADE;
DROP TYPE IF EXISTS public.managerial_role CASCADE;
DROP TYPE IF EXISTS public.employee_type CASCADE;
DROP TYPE IF EXISTS public.app_role_new CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- ============================================
-- RECREATE ENUMS
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'sales', 'orders', 'finance', 'projects', 'employee', 'manager');
CREATE TYPE public.app_role_new AS ENUM ('admin', 'sales', 'orders', 'finance', 'projects');
CREATE TYPE public.employee_type AS ENUM ('employee', 'manager');
CREATE TYPE public.expense_status AS ENUM ('draft', 'pending_manager_approval', 'approved', 'rejected', 'paid', 'retired');
CREATE TYPE public.managerial_role AS ENUM ('director_finance', 'director_business', 'director_cx', 'head_compliance', 'director_of_technology');
CREATE TYPE public.workflow_stage AS ENUM ('quote_uploaded', 'customer_po_uploaded', 'company_po_uploaded', 'waybill_created', 'invoice_generated', 'completed', 'awaiting_project_completion', 'project_completed');

-- ============================================
-- RECREATE SEQUENCES
-- ============================================
CREATE SEQUENCE IF NOT EXISTS public.expense_ticket_seq;

-- ============================================
-- RECREATE TABLES
-- ============================================

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Departments (with unique constraints on both name and slug)
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  employee_type public.employee_type NOT NULL DEFAULT 'employee',
  department_role public.app_role_new,
  department_id UUID REFERENCES public.departments(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User Department Assignments
CREATE TABLE public.user_department_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- Department Hierarchy
CREATE TABLE public.department_hierarchy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL UNIQUE REFERENCES public.departments(id),
  reports_to public.managerial_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Manager Assignments
CREATE TABLE public.manager_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  role public.managerial_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Employee Manager Mapping
CREATE TABLE public.employee_manager_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL UNIQUE,
  manager_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Quotes
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Customer POs
CREATE TABLE public.customer_pos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id),
  po_number TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Company POs
CREATE TABLE public.company_pos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_po_id UUID NOT NULL REFERENCES public.customer_pos(id),
  po_number TEXT NOT NULL,
  distributor_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Distributor Quotes
CREATE TABLE public.distributor_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_po_id UUID REFERENCES public.company_pos(id),
  customer_po_id UUID REFERENCES public.customer_pos(id),
  quote_number TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Distributor Invoices
CREATE TABLE public.distributor_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_po_id UUID NOT NULL REFERENCES public.company_pos(id),
  invoice_number TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Waybills
CREATE TABLE public.waybills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_po_id UUID NOT NULL REFERENCES public.company_pos(id),
  waybill_number TEXT NOT NULL,
  product_details TEXT,
  serial_numbers TEXT[],
  file_path TEXT,
  file_name TEXT,
  signed_waybill_path TEXT,
  signed_waybill_name TEXT,
  signed_by UUID,
  signed_at TIMESTAMP WITH TIME ZONE,
  delivery_status TEXT DEFAULT 'pending',
  total_items_ordered INTEGER DEFAULT 0,
  total_items_delivered INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Waybill Items
CREATE TABLE public.waybill_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waybill_id UUID REFERENCES public.waybills(id),
  company_po_id UUID REFERENCES public.company_pos(id),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  items_received INTEGER DEFAULT 0,
  items_outstanding INTEGER,
  serial_number TEXT,
  reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Delivery Records
CREATE TABLE public.delivery_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waybill_id UUID NOT NULL REFERENCES public.waybills(id),
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_notes TEXT,
  delivered_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Delivery Items
CREATE TABLE public.delivery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_record_id UUID NOT NULL REFERENCES public.delivery_records(id),
  waybill_item_id UUID NOT NULL REFERENCES public.waybill_items(id),
  quantity_delivered INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Projects
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_number TEXT NOT NULL,
  project_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  start_date TIMESTAMP WITH TIME ZONE,
  completion_date TIMESTAMP WITH TIME ZONE,
  documentation_path TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Invoices
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id),
  customer_po_id UUID NOT NULL REFERENCES public.customer_pos(id),
  company_po_id UUID NOT NULL REFERENCES public.company_pos(id),
  invoice_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  file_path TEXT,
  file_name TEXT,
  generated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Workflow Tracker
CREATE TABLE public.workflow_tracker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL UNIQUE REFERENCES public.quotes(id),
  current_stage public.workflow_stage NOT NULL DEFAULT 'quote_uploaded',
  customer_po_id UUID REFERENCES public.customer_pos(id),
  company_po_id UUID REFERENCES public.company_pos(id),
  invoice_id UUID REFERENCES public.invoices(id),
  project_id UUID REFERENCES public.projects(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Expense Tickets
CREATE TABLE public.expense_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL,
  employee_id UUID,
  manager_id UUID,
  issued_in_favour_of TEXT NOT NULL,
  purpose TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC NOT NULL,
  amount_requested NUMERIC,
  actual_amount_spent NUMERIC,
  remaining_balance NUMERIC,
  currency TEXT NOT NULL DEFAULT 'GHS',
  status public.expense_status NOT NULL DEFAULT 'draft',
  has_receipt BOOLEAN DEFAULT true,
  digital_signature TEXT,
  manager_notes TEXT,
  manager_approved_at TIMESTAMP WITH TIME ZONE,
  finance_paid_at TIMESTAMP WITH TIME ZONE,
  finance_paid_by UUID,
  payment_details TEXT,
  payment_acknowledged BOOLEAN DEFAULT false,
  payment_acknowledged_at TIMESTAMP WITH TIME ZONE,
  refund_status TEXT DEFAULT 'no_refund_required',
  refund_confirmed_by UUID,
  refund_confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Expense Details
CREATE TABLE public.expense_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_ticket_id UUID NOT NULL REFERENCES public.expense_tickets(id),
  type TEXT NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Expense Retirements
CREATE TABLE public.expense_retirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_ticket_id UUID NOT NULL REFERENCES public.expense_tickets(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  notes TEXT,
  uploaded_by UUID,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Expense Audit Logs
CREATE TABLE public.expense_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_ticket_id UUID NOT NULL REFERENCES public.expense_tickets(id),
  user_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Audit Logs
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_type TEXT,
  related_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- RECREATE FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.generate_expense_ticket_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  seq BIGINT;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  seq := nextval('public.expense_ticket_seq');
  RETURN 'EXP-' || current_year || '-' || LPAD(seq::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND department_role::text = _role::text
  )
$$;

CREATE OR REPLACE FUNCTION public.has_department_role(_user_id uuid, _role app_role_new)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND employee_type = _type
  )
$$;

CREATE OR REPLACE FUNCTION public.is_approving_director(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.manager_assignments ma
    WHERE ma.user_id = _user_id
    AND ma.role IN ('director_business', 'director_of_technology')
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  INSERT INTO public.user_roles (user_id, employee_type)
  VALUES (NEW.id, 'employee'::employee_type)
  ON CONFLICT (user_id) DO UPDATE
  SET employee_type = EXCLUDED.employee_type;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_employee_to_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_role public.managerial_role;
  manager_user_id UUID;
BEGIN
  IF NEW.department_id IS NOT NULL AND NEW.employee_type = 'employee' THEN
    SELECT dh.reports_to INTO manager_role
    FROM public.department_hierarchy dh
    WHERE dh.department_id = NEW.department_id;
    
    IF manager_role IS NOT NULL THEN
      SELECT ma.user_id INTO manager_user_id
      FROM public.manager_assignments ma
      WHERE ma.role = manager_role
      LIMIT 1;
      
      IF manager_user_id IS NOT NULL THEN
        INSERT INTO public.employee_manager_mapping (employee_id, manager_id)
        VALUES (NEW.user_id, manager_user_id)
        ON CONFLICT (employee_id) 
        DO UPDATE SET manager_id = manager_user_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_expense_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.notify_managers_on_expense_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  employee_name TEXT;
  is_manager_ticket BOOLEAN;
  manager_users UUID[];
BEGIN
  IF NEW.status = 'pending_manager_approval' AND (TG_OP = 'INSERT' OR OLD.status != 'pending_manager_approval') THEN
    SELECT p.full_name INTO employee_name
    FROM public.profiles p
    WHERE p.id = NEW.employee_id;
    
    SELECT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = NEW.employee_id 
      AND employee_type = 'manager'::employee_type
    ) INTO is_manager_ticket;
    
    IF is_manager_ticket THEN
      SELECT array_agg(user_id) INTO manager_users
      FROM user_roles
      WHERE employee_type = 'manager'::employee_type
      AND user_id != NEW.employee_id
      AND user_id IS NOT NULL;
      
      IF manager_users IS NOT NULL AND array_length(manager_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, related_type, related_id)
        SELECT 
          unnest(manager_users),
          'Manager Expense Ticket',
          format('Expense ticket %s from manager %s is pending approval (GHS %s)', NEW.ticket_number, COALESCE(employee_name, 'Manager'), NEW.total_amount),
          'expense_ticket',
          NEW.id;
      END IF;
    ELSE
      IF NEW.manager_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, related_type, related_id)
        VALUES (
          NEW.manager_id,
          'New Expense Ticket',
          format('Expense ticket %s from %s is pending your approval (GHS %s)', NEW.ticket_number, COALESCE(employee_name, 'Employee'), NEW.total_amount),
          'expense_ticket',
          NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_next_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_role app_role_new;
  target_users uuid[];
  quote_customer text;
  quote_num text;
  has_project boolean;
BEGIN
  SELECT customer_name, quote_number INTO quote_customer, quote_num
  FROM quotes WHERE id = NEW.quote_id;

  has_project := NEW.project_id IS NOT NULL;

  IF NEW.current_stage = 'customer_po_uploaded' THEN
    target_role := 'orders';
  ELSIF NEW.current_stage = 'company_po_uploaded' THEN
    target_role := 'orders';
  ELSIF NEW.current_stage = 'waybill_created' THEN
    IF has_project THEN
      target_role := 'projects';
    ELSE
      target_role := 'finance';
    END IF;
  ELSIF NEW.current_stage = 'project_completed' THEN
    target_role := 'finance';
  ELSE
    RETURN NEW;
  END IF;

  SELECT array_agg(user_id) INTO target_users
  FROM user_roles
  WHERE department_role = target_role;

  IF target_users IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, related_type, related_id)
    SELECT 
      unnest(target_users),
      'New Task Available',
      format('Quote %s for %s is ready for %s team processing', quote_num, quote_customer, target_role),
      'workflow',
      NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_document(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR split_part(_path, '/', 1) = _user_id::text
    OR (
      public.has_role(_user_id, 'sales') AND EXISTS (
        SELECT 1 FROM public.quotes q WHERE q.file_path = _path
      )
    )
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
    OR (
      public.has_role(_user_id, 'projects') AND EXISTS (
        SELECT 1 FROM public.projects p WHERE p.documentation_path = _path
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.update_workflow_on_customer_po()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE workflow_tracker
  SET 
    customer_po_id = NEW.id,
    current_stage = 'customer_po_uploaded',
    updated_at = NOW()
  WHERE quote_id = NEW.quote_id
    AND customer_po_id IS NULL;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_workflow_on_company_po()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE workflow_tracker
  SET 
    company_po_id = NEW.id,
    current_stage = 'company_po_uploaded',
    updated_at = NOW()
  WHERE customer_po_id = NEW.customer_po_id
    AND company_po_id IS NULL;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_workflow_on_waybill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE workflow_tracker wt
  SET 
    current_stage = 'waybill_created',
    updated_at = NOW()
  WHERE company_po_id = NEW.company_po_id
    AND current_stage = 'company_po_uploaded';
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_workflow_on_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE workflow_tracker
  SET 
    invoice_id = NEW.id,
    current_stage = 'invoice_generated',
    updated_at = NOW()
  WHERE quote_id = NEW.quote_id
    AND invoice_id IS NULL;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_workflow_on_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  workflow_quote_id UUID;
BEGIN
  SELECT wt.id INTO workflow_quote_id
  FROM workflow_tracker wt
  JOIN quotes q ON wt.quote_id = q.id
  WHERE NEW.project_number LIKE '%' || q.quote_number || '%'
  LIMIT 1;
  
  IF workflow_quote_id IS NOT NULL THEN
    UPDATE workflow_tracker
    SET 
      project_id = NEW.id,
      current_stage = CASE 
        WHEN current_stage = 'waybill_created' THEN 'awaiting_project_completion'
        ELSE current_stage
      END,
      updated_at = NOW()
    WHERE id = workflow_quote_id
      AND project_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_workflow_on_project_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE workflow_tracker
    SET 
      current_stage = 'project_completed',
      updated_at = NOW()
    WHERE project_id = NEW.id
      AND current_stage IN ('waybill_created', 'awaiting_project_completion');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_waybill_item_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_received integer;
  target_waybill_id uuid;
BEGIN
  SELECT COALESCE(SUM(quantity_delivered), 0)
  INTO total_received
  FROM public.delivery_items
  WHERE waybill_item_id = NEW.waybill_item_id;

  UPDATE public.waybill_items
  SET items_received = total_received, updated_at = now()
  WHERE id = NEW.waybill_item_id
  RETURNING waybill_id INTO target_waybill_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_waybill_delivery_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_ordered integer;
  total_delivered integer;
  new_status text;
BEGIN
  SELECT 
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(items_received), 0)
  INTO total_ordered, total_delivered
  FROM public.waybill_items
  WHERE waybill_id = NEW.waybill_id;

  IF total_delivered = 0 THEN
    new_status := 'pending';
  ELSIF total_delivered >= total_ordered THEN
    new_status := 'fully_delivered';
  ELSE
    new_status := 'partially_delivered';
  END IF;

  UPDATE public.waybills
  SET 
    delivery_status = new_status,
    total_items_ordered = total_ordered,
    total_items_delivered = total_delivered,
    updated_at = now()
  WHERE id = NEW.waybill_id;

  RETURN NEW;
END;
$$;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_department_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_manager_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waybills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waybill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_retirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Profiles are viewable by self, managers, finance, admins" ON public.profiles
FOR SELECT USING (
  auth.uid() = id 
  OR has_employee_type(auth.uid(), 'manager'::employee_type) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Departments policies
CREATE POLICY "Authenticated users can view departments" ON public.departments
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage departments" ON public.departments
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User department assignments policies
CREATE POLICY "Users can view their own department assignments" ON public.user_department_assignments
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Managers can view department assignments" ON public.user_department_assignments
FOR SELECT USING (has_employee_type(auth.uid(), 'manager'::employee_type));

CREATE POLICY "Admins can manage user department assignments" ON public.user_department_assignments
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Department hierarchy policies
CREATE POLICY "Anyone can read department hierarchy" ON public.department_hierarchy
FOR SELECT USING (true);

CREATE POLICY "Admins can manage department hierarchy" ON public.department_hierarchy
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Manager assignments policies
CREATE POLICY "Managers and admins can view manager assignments" ON public.manager_assignments
FOR SELECT USING (
  has_employee_type(auth.uid(), 'manager'::employee_type) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Only admins can manage manager assignments" ON public.manager_assignments
FOR ALL USING (has_department_role(auth.uid(), 'admin'::app_role_new));

-- Employee manager mapping policies
CREATE POLICY "Employees can view their manager" ON public.employee_manager_mapping
FOR SELECT USING (
  employee_id = auth.uid() 
  OR manager_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can manage employee-manager mappings" ON public.employee_manager_mapping
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Quotes policies
CREATE POLICY "Authorized roles can view quotes" ON public.quotes
FOR SELECT USING (
  has_department_role(auth.uid(), 'sales'::app_role_new) 
  OR has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Sales can create quotes" ON public.quotes
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'sales'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Sales can update their quotes" ON public.quotes
FOR UPDATE USING (
  uploaded_by = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Customer POs policies
CREATE POLICY "Authorized roles can view customer POs" ON public.customer_pos
FOR SELECT USING (
  has_department_role(auth.uid(), 'sales'::app_role_new) 
  OR has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Sales can create customer POs" ON public.customer_pos
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'sales'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Company POs policies
CREATE POLICY "Authorized roles can view company POs" ON public.company_pos
FOR SELECT USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can create company POs" ON public.company_pos
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'orders'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Distributor quotes policies
CREATE POLICY "Orders Finance and Sales can view distributor quotes" ON public.distributor_quotes
FOR SELECT USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'sales'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders and Sales can create distributor quotes" ON public.distributor_quotes
FOR INSERT WITH CHECK (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'sales'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Distributor invoices policies
CREATE POLICY "Orders and Finance can view distributor invoices" ON public.distributor_invoices
FOR SELECT USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can create distributor invoices" ON public.distributor_invoices
FOR INSERT WITH CHECK (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Waybills policies
CREATE POLICY "Authorized roles can view waybills" ON public.waybills
FOR SELECT USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'projects'::app_role_new) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can manage waybills" ON public.waybills
FOR ALL USING (
  has_role(auth.uid(), 'orders'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Waybill items policies
CREATE POLICY "Orders Finance Projects can view waybill items" ON public.waybill_items
FOR SELECT USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'projects'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can manage waybill items" ON public.waybill_items
FOR ALL USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Delivery records policies
CREATE POLICY "Orders Finance Projects can view delivery records" ON public.delivery_records
FOR SELECT USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'projects'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can manage delivery records" ON public.delivery_records
FOR ALL USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Delivery items policies
CREATE POLICY "Orders Finance Projects can view delivery items" ON public.delivery_items
FOR SELECT USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'projects'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can manage delivery items" ON public.delivery_items
FOR ALL USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Projects policies
CREATE POLICY "Projects team can view all projects" ON public.projects
FOR SELECT USING (
  has_role(auth.uid(), 'projects'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'orders'::app_role)
);

CREATE POLICY "Projects team can create projects" ON public.projects
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'projects'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Projects team can update projects" ON public.projects
FOR UPDATE USING (
  has_role(auth.uid(), 'projects'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Invoices policies
CREATE POLICY "Finance and admins can view invoices" ON public.invoices
FOR SELECT USING (
  has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Finance can create invoices" ON public.invoices
FOR INSERT WITH CHECK (
  has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Workflow tracker policies
CREATE POLICY "Sales can view workflows" ON public.workflow_tracker
FOR SELECT USING (
  has_department_role(auth.uid(), 'sales'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Sales can create workflows" ON public.workflow_tracker
FOR INSERT WITH CHECK (
  has_department_role(auth.uid(), 'sales'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can view workflows" ON public.workflow_tracker
FOR SELECT USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can update workflows" ON public.workflow_tracker
FOR UPDATE USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  AND current_stage IN ('customer_po_uploaded', 'company_po_uploaded', 'waybill_created')
);

CREATE POLICY "Finance can view workflows" ON public.workflow_tracker
FOR SELECT USING (
  has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Finance can update workflows for invoice generation" ON public.workflow_tracker
FOR UPDATE USING (
  has_department_role(auth.uid(), 'finance'::app_role_new) 
  AND (current_stage = 'project_completed' OR (current_stage = 'waybill_created' AND project_id IS NULL))
)
WITH CHECK (
  has_department_role(auth.uid(), 'finance'::app_role_new) 
  AND (current_stage = 'invoice_generated' OR current_stage = 'project_completed' OR (current_stage = 'waybill_created' AND project_id IS NULL))
);

CREATE POLICY "Projects can view workflows" ON public.workflow_tracker
FOR SELECT USING (
  has_department_role(auth.uid(), 'projects'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Projects can update workflows" ON public.workflow_tracker
FOR UPDATE USING (
  has_department_role(auth.uid(), 'projects'::app_role_new) 
  AND current_stage = 'waybill_created' 
  AND project_id IS NOT NULL
);

CREATE POLICY "Admin can manage all workflows" ON public.workflow_tracker
FOR ALL USING (has_department_role(auth.uid(), 'admin'::app_role_new));

-- Expense tickets policies
CREATE POLICY "Users can view expense tickets" ON public.expense_tickets
FOR SELECT USING (
  employee_id = auth.uid() 
  OR manager_id = auth.uid() 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
  OR (has_employee_type(auth.uid(), 'manager'::employee_type) AND status = 'pending_manager_approval' AND employee_id != auth.uid())
);

CREATE POLICY "Authenticated users can create their own tickets" ON public.expense_tickets
FOR INSERT WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Users can update tickets based on role" ON public.expense_tickets
FOR UPDATE USING (
  employee_id = auth.uid() 
  OR has_employee_type(auth.uid(), 'manager'::employee_type) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
)
WITH CHECK (
  employee_id = auth.uid() 
  OR has_employee_type(auth.uid(), 'manager'::employee_type) 
  OR has_department_role(auth.uid(), 'finance'::app_role_new) 
  OR has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Admins can delete expense tickets" ON public.expense_tickets
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Expense details policies
CREATE POLICY "Users can view expense details of their tickets" ON public.expense_details
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM expense_tickets et
    WHERE et.id = expense_details.expense_ticket_id
    AND (et.employee_id = auth.uid() OR et.manager_id = auth.uid() OR has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Employees can manage details of their tickets" ON public.expense_details
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM expense_tickets et
    WHERE et.id = expense_details.expense_ticket_id
    AND et.employee_id = auth.uid()
  )
);

-- Expense retirements policies
CREATE POLICY "Users can view retirements of their tickets" ON public.expense_retirements
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM expense_tickets et
    WHERE et.id = expense_retirements.expense_ticket_id
    AND (et.employee_id = auth.uid() OR et.manager_id = auth.uid() OR has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Employees can upload retirement documents" ON public.expense_retirements
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM expense_tickets et
    WHERE et.id = expense_retirements.expense_ticket_id
    AND et.employee_id = auth.uid()
    AND et.status = 'paid'
  )
);

-- Expense audit logs policies
CREATE POLICY "Users can view audit logs of their tickets" ON public.expense_audit_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM expense_tickets et
    WHERE et.id = expense_audit_logs.expense_ticket_id
    AND (et.employee_id = auth.uid() OR et.manager_id = auth.uid() OR has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Audit logs policies
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Notifications policies
CREATE POLICY "Users can view their notifications" ON public.notifications
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications" ON public.notifications
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Block direct user inserts to notifications" ON public.notifications
FOR INSERT WITH CHECK (false);

-- ============================================
-- CREATE TRIGGERS
-- ============================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_workflow_on_customer_po_trigger
  AFTER INSERT ON public.customer_pos
  FOR EACH ROW EXECUTE FUNCTION public.update_workflow_on_customer_po();

CREATE TRIGGER update_workflow_on_company_po_trigger
  AFTER INSERT ON public.company_pos
  FOR EACH ROW EXECUTE FUNCTION public.update_workflow_on_company_po();

CREATE TRIGGER update_workflow_on_waybill_trigger
  AFTER INSERT ON public.waybills
  FOR EACH ROW EXECUTE FUNCTION public.update_workflow_on_waybill();

CREATE TRIGGER update_workflow_on_invoice_trigger
  AFTER INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_workflow_on_invoice();

CREATE TRIGGER update_workflow_on_project_trigger
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_workflow_on_project();

CREATE TRIGGER update_workflow_on_project_complete_trigger
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_workflow_on_project_complete();

CREATE TRIGGER on_expense_ticket_change
  AFTER INSERT OR UPDATE ON public.expense_tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_expense_action();

CREATE TRIGGER on_expense_submit
  AFTER INSERT OR UPDATE ON public.expense_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_managers_on_expense_submit();

CREATE TRIGGER update_waybill_item_received_trigger
  AFTER INSERT OR UPDATE ON public.delivery_items
  FOR EACH ROW EXECUTE FUNCTION public.update_waybill_item_received();

CREATE TRIGGER update_waybill_delivery_status_trigger
  AFTER INSERT OR UPDATE ON public.waybill_items
  FOR EACH ROW EXECUTE FUNCTION public.update_waybill_delivery_status();

-- ============================================
-- SEED DEFAULT DEPARTMENTS
-- ============================================

INSERT INTO public.departments (name, slug) VALUES
  ('Sales', 'sales'),
  ('Orders', 'orders'),
  ('Finance', 'finance'),
  ('Projects', 'projects'),
  ('Admin', 'admin'),
  ('Data Services', 'data-services'),
  ('HR & Admin', 'hr-admin'),
  ('Infotech', 'infotech'),
  ('Compliance', 'compliance'),
  ('Marketing', 'marketing');

-- ============================================
-- SEED DEPARTMENT HIERARCHY
-- ============================================

INSERT INTO public.department_hierarchy (department_id, reports_to)
SELECT d.id, 'director_business'::managerial_role FROM public.departments d WHERE d.slug = 'sales'
UNION ALL
SELECT d.id, 'director_cx'::managerial_role FROM public.departments d WHERE d.slug = 'orders'
UNION ALL
SELECT d.id, 'director_finance'::managerial_role FROM public.departments d WHERE d.slug = 'finance'
UNION ALL
SELECT d.id, 'director_of_technology'::managerial_role FROM public.departments d WHERE d.slug = 'projects'
UNION ALL
SELECT d.id, 'director_business'::managerial_role FROM public.departments d WHERE d.slug = 'admin'
UNION ALL
SELECT d.id, 'director_of_technology'::managerial_role FROM public.departments d WHERE d.slug = 'data-services'
UNION ALL
SELECT d.id, 'director_business'::managerial_role FROM public.departments d WHERE d.slug = 'hr-admin'
UNION ALL
SELECT d.id, 'director_of_technology'::managerial_role FROM public.departments d WHERE d.slug = 'infotech'
UNION ALL
SELECT d.id, 'head_compliance'::managerial_role FROM public.departments d WHERE d.slug = 'compliance'
UNION ALL
SELECT d.id, 'director_business'::managerial_role FROM public.departments d WHERE d.slug = 'marketing';

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Drop existing storage policies first
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Orders can upload signed waybills" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload expense retirements" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their expense retirement files" ON storage.objects;

-- Documents bucket policies
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view documents they have access to"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND public.can_access_document(auth.uid(), name)
);

CREATE POLICY "Orders can upload signed waybills"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'signed-waybills'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (
    has_department_role(auth.uid(), 'orders'::app_role_new) 
    OR has_department_role(auth.uid(), 'admin'::app_role_new)
  )
);

-- Expense retirements bucket policies
CREATE POLICY "Authenticated users can upload expense retirements"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'expense-retirements' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view their expense retirement files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'expense-retirements' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);