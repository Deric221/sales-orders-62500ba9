-- Remove legacy trigger that inserts a single manager notification causing NULL user_id for manager tickets
DROP TRIGGER IF EXISTS trigger_notify_manager_expense ON public.expense_tickets;

-- Keep the newer trigger (on_expense_ticket_status_change) which handles both employee and manager cases safely.

-- Optional: keep the old function for backwards compatibility; do not drop to avoid breaking references elsewhere.