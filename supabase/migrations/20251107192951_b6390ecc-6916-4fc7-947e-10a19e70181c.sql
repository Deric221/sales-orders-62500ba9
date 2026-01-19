-- Fix manager-to-manager expense approval RLS
-- The issue: WITH CHECK validates NEW rows, so when changing status to approved/rejected,
-- it should allow managers to do so without restrictions

drop policy if exists "Employees and managers can update their tickets" on public.expense_tickets;

create policy "Employees and managers can update their tickets"
on public.expense_tickets
for update
using (
  -- USING checks the OLD row: can this user update this ticket?
  employee_id = auth.uid()
  or manager_id = auth.uid()
  or has_department_role(auth.uid(), 'finance'::app_role_new)
  or has_department_role(auth.uid(), 'admin'::app_role_new)
  or (
    -- Peer manager acting on someone else's pending ticket
    has_employee_type(auth.uid(), 'manager'::employee_type)
    and status = 'pending_manager_approval'::expense_status
    and employee_id <> auth.uid()
  )
)
with check (
  -- WITH CHECK validates the NEW row: is the updated row valid?
  -- Allow if user owns the ticket
  employee_id = auth.uid()
  -- Allow if user is the assigned manager
  or manager_id = auth.uid()
  -- Allow finance and admin
  or has_department_role(auth.uid(), 'finance'::app_role_new)
  or has_department_role(auth.uid(), 'admin'::app_role_new)
  -- Allow peer manager for manager-submitted tickets (manager_id is null for manager tickets)
  or (
    has_employee_type(auth.uid(), 'manager'::employee_type)
    and employee_id <> auth.uid()
    and manager_id is null
  )
);