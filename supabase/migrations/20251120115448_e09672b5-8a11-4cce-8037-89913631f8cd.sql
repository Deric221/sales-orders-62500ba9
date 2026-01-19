-- Fix workflow stages that should be project_completed based on project status
-- This addresses the issue where projects are completed but workflows show waybill_created

UPDATE workflow_tracker wt
SET current_stage = 'project_completed'
FROM projects p
WHERE wt.project_id = p.id
  AND p.status = 'completed'
  AND wt.current_stage IN ('waybill_created', 'awaiting_project_completion')
  AND wt.invoice_id IS NULL;