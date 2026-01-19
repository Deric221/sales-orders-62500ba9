
-- Create trigger function to automatically update workflow_tracker when customer PO is uploaded
CREATE OR REPLACE FUNCTION update_workflow_on_customer_po()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for customer PO uploads
DROP TRIGGER IF EXISTS trigger_update_workflow_on_customer_po ON customer_pos;
CREATE TRIGGER trigger_update_workflow_on_customer_po
AFTER INSERT ON customer_pos
FOR EACH ROW
EXECUTE FUNCTION update_workflow_on_customer_po();

-- Create trigger function to automatically update workflow_tracker when company PO is uploaded
CREATE OR REPLACE FUNCTION update_workflow_on_company_po()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for company PO uploads
DROP TRIGGER IF EXISTS trigger_update_workflow_on_company_po ON company_pos;
CREATE TRIGGER trigger_update_workflow_on_company_po
AFTER INSERT ON company_pos
FOR EACH ROW
EXECUTE FUNCTION update_workflow_on_company_po();

-- Create trigger function to automatically update workflow_tracker when waybill is created
CREATE OR REPLACE FUNCTION update_workflow_on_waybill()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE workflow_tracker wt
  SET 
    current_stage = 'waybill_created',
    updated_at = NOW()
  WHERE company_po_id = NEW.company_po_id
    AND current_stage = 'company_po_uploaded';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for waybill creation
DROP TRIGGER IF EXISTS trigger_update_workflow_on_waybill ON waybills;
CREATE TRIGGER trigger_update_workflow_on_waybill
AFTER INSERT ON waybills
FOR EACH ROW
EXECUTE FUNCTION update_workflow_on_waybill();

-- Create trigger function to automatically update workflow_tracker when project is linked
CREATE OR REPLACE FUNCTION update_workflow_on_project()
RETURNS TRIGGER AS $$
DECLARE
  workflow_quote_id UUID;
BEGIN
  -- Find workflow by matching quote number in project number
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for project creation
DROP TRIGGER IF EXISTS trigger_update_workflow_on_project ON projects;
CREATE TRIGGER trigger_update_workflow_on_project
AFTER INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION update_workflow_on_project();

-- Create trigger function to automatically update workflow_tracker when project is completed
CREATE OR REPLACE FUNCTION update_workflow_on_project_complete()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for project completion
DROP TRIGGER IF EXISTS trigger_update_workflow_on_project_complete ON projects;
CREATE TRIGGER trigger_update_workflow_on_project_complete
AFTER UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_workflow_on_project_complete();

-- Create trigger function to automatically update workflow_tracker when invoice is generated
CREATE OR REPLACE FUNCTION update_workflow_on_invoice()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for invoice generation
DROP TRIGGER IF EXISTS trigger_update_workflow_on_invoice ON invoices;
CREATE TRIGGER trigger_update_workflow_on_invoice
AFTER INSERT ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_workflow_on_invoice();
