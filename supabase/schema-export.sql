-- Full Schema Export from Lovable Cloud
-- Generated: 2024-12-11
-- Use this file with: psql -f supabase/schema-export.sql

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'sales', 'orders', 'finance', 'projects', 'employee', 'manager');
CREATE TYPE public.app_role_new AS ENUM ('admin', 'sales', 'orders', 'finance', 'projects');
CREATE TYPE public.employee_type AS ENUM ('employee', 'manager');
CREATE TYPE public.expense_status AS ENUM ('draft', 'pending_manager_approval', 'approved', 'rejected', 'paid', 'retired');
CREATE TYPE public.managerial_role AS ENUM ('director_finance', 'director_business', 'director_cx', 'head_compliance', 'director_of_technology');
CREATE TYPE public.workflow_stage AS ENUM ('quote_uploaded', 'customer_po_uploaded', 'company_po_uploaded', 'waybill_created', 'invoice_generated', 'completed', 'awaiting_project_completion', 'project_completed');

-- ============================================
-- SEQUENCES
-- ============================================

CREATE SEQUENCE IF NOT EXISTS public.expense_ticket_seq;

-- ============================================
-- TABLES
-- ============================================

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Departments
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
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
  company_po_id UUID NOT NULL REFERENCES public.company_pos(id),
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
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
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
-- FUNCTIONS
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

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_manager_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waybills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_retirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies are not included in this export.
-- You'll need to run supabase db reset to apply migrations which include policies.
