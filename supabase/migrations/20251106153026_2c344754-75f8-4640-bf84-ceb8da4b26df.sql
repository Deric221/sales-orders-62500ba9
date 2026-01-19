-- Fix critical RLS policy vulnerabilities

-- 1. Fix notifications table - Remove permissive INSERT policy
-- Keep existing SELECT and UPDATE policies, remove the permissive "System can manage workflow" policy
DROP POLICY IF EXISTS "System can manage workflow" ON public.notifications;

-- Note: Notifications can only be created by SECURITY DEFINER triggers (notify_manager_on_expense_submit, notify_next_role)
-- or edge functions using service role. No direct INSERT policy for authenticated users.

-- 2. Fix workflow_tracker table - Split into granular role-based policies
DROP POLICY IF EXISTS "System can manage workflow" ON public.workflow_tracker;
DROP POLICY IF EXISTS "Everyone can view workflow" ON public.workflow_tracker;

-- Allow sales to view all workflows (they create quotes)
CREATE POLICY "Sales can view workflows"
ON public.workflow_tracker
FOR SELECT
USING (has_department_role(auth.uid(), 'sales'::app_role_new) OR has_department_role(auth.uid(), 'admin'::app_role_new));

-- Allow orders to view and update workflows at relevant stages
CREATE POLICY "Orders can view workflows"
ON public.workflow_tracker
FOR SELECT
USING (has_department_role(auth.uid(), 'orders'::app_role_new) OR has_department_role(auth.uid(), 'admin'::app_role_new));

CREATE POLICY "Orders can update workflows"
ON public.workflow_tracker
FOR UPDATE
USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) 
  AND current_stage IN ('customer_po_uploaded', 'company_po_uploaded', 'waybill_created')
);

-- Allow projects team to view and update workflows when project is involved
CREATE POLICY "Projects can view workflows"
ON public.workflow_tracker
FOR SELECT
USING (has_department_role(auth.uid(), 'projects'::app_role_new) OR has_department_role(auth.uid(), 'admin'::app_role_new));

CREATE POLICY "Projects can update workflows"
ON public.workflow_tracker
FOR UPDATE
USING (
  has_department_role(auth.uid(), 'projects'::app_role_new)
  AND current_stage = 'waybill_created'
  AND project_id IS NOT NULL
);

-- Allow finance to view and update workflows at final stage
CREATE POLICY "Finance can view workflows"
ON public.workflow_tracker
FOR SELECT
USING (has_department_role(auth.uid(), 'finance'::app_role_new) OR has_department_role(auth.uid(), 'admin'::app_role_new));

CREATE POLICY "Finance can update workflows"
ON public.workflow_tracker
FOR UPDATE
USING (
  has_department_role(auth.uid(), 'finance'::app_role_new)
  AND current_stage IN ('project_completed', 'waybill_created')
);

-- Allow sales to create workflows when uploading quotes (via triggers)
CREATE POLICY "Sales can create workflows"
ON public.workflow_tracker
FOR INSERT
WITH CHECK (has_department_role(auth.uid(), 'sales'::app_role_new) OR has_department_role(auth.uid(), 'admin'::app_role_new));

-- Admin can do everything
CREATE POLICY "Admin can manage all workflows"
ON public.workflow_tracker
FOR ALL
USING (has_department_role(auth.uid(), 'admin'::app_role_new));