-- Make all user reference columns nullable
ALTER TABLE public.expense_tickets ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE public.expense_audit_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.expense_retirements ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.company_pos ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.customer_pos ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.distributor_invoices ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.distributor_quotes ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.expense_tickets ALTER COLUMN finance_paid_by DROP NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN generated_by DROP NOT NULL;
ALTER TABLE public.projects ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.quotes ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.waybills ALTER COLUMN created_by DROP NOT NULL;

-- Update all foreign keys with proper CASCADE/SET NULL behavior
ALTER TABLE public.expense_audit_logs DROP CONSTRAINT IF EXISTS expense_audit_logs_user_id_fkey;
ALTER TABLE public.expense_audit_logs ADD CONSTRAINT expense_audit_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.expense_retirements DROP CONSTRAINT IF EXISTS expense_retirements_uploaded_by_fkey;
ALTER TABLE public.expense_retirements ADD CONSTRAINT expense_retirements_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.company_pos DROP CONSTRAINT IF EXISTS company_pos_uploaded_by_fkey;
ALTER TABLE public.company_pos ADD CONSTRAINT company_pos_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.customer_pos DROP CONSTRAINT IF EXISTS customer_pos_uploaded_by_fkey;
ALTER TABLE public.customer_pos ADD CONSTRAINT customer_pos_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.distributor_invoices DROP CONSTRAINT IF EXISTS distributor_invoices_uploaded_by_fkey;
ALTER TABLE public.distributor_invoices ADD CONSTRAINT distributor_invoices_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.distributor_quotes DROP CONSTRAINT IF EXISTS distributor_quotes_uploaded_by_fkey;
ALTER TABLE public.distributor_quotes ADD CONSTRAINT distributor_quotes_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.employee_manager_mapping DROP CONSTRAINT IF EXISTS employee_manager_mapping_employee_id_fkey;
ALTER TABLE public.employee_manager_mapping DROP CONSTRAINT IF EXISTS employee_manager_mapping_manager_id_fkey;
ALTER TABLE public.employee_manager_mapping ADD CONSTRAINT employee_manager_mapping_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.employee_manager_mapping ADD CONSTRAINT employee_manager_mapping_manager_id_fkey 
FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.expense_tickets DROP CONSTRAINT IF EXISTS expense_tickets_employee_id_fkey;
ALTER TABLE public.expense_tickets DROP CONSTRAINT IF EXISTS expense_tickets_manager_id_fkey;
ALTER TABLE public.expense_tickets DROP CONSTRAINT IF EXISTS expense_tickets_finance_paid_by_fkey;
ALTER TABLE public.expense_tickets ADD CONSTRAINT expense_tickets_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.expense_tickets ADD CONSTRAINT expense_tickets_manager_id_fkey 
FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.expense_tickets ADD CONSTRAINT expense_tickets_finance_paid_by_fkey 
FOREIGN KEY (finance_paid_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_generated_by_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_generated_by_fkey 
FOREIGN KEY (generated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.manager_assignments DROP CONSTRAINT IF EXISTS manager_assignments_user_id_fkey;
ALTER TABLE public.manager_assignments ADD CONSTRAINT manager_assignments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
ALTER TABLE public.projects ADD CONSTRAINT projects_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_uploaded_by_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.waybills DROP CONSTRAINT IF EXISTS waybills_created_by_fkey;
ALTER TABLE public.waybills ADD CONSTRAINT waybills_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Delete all users except admin
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@saleskeeper.org';
  
  DELETE FROM auth.users 
  WHERE id != admin_user_id;
END $$;