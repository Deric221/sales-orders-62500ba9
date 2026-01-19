-- First, clear existing manager assignments to rebuild properly
TRUNCATE manager_assignments CASCADE;

-- Director of Finance manages: Finance, HR & ADMIN, INFOTECH, HSEQ
INSERT INTO manager_assignments (role, department_id, user_id)
SELECT 'director_finance'::managerial_role, d.id, ur.user_id
FROM departments d
CROSS JOIN user_roles ur
WHERE d.slug IN ('finance', 'hr_admin', 'infotech', 'hseq')
AND ur.department_role = 'finance'
AND ur.employee_type = 'manager'
LIMIT 1;

-- Director of Business manages: Sales, Marketing, Orders
INSERT INTO manager_assignments (role, department_id, user_id)
SELECT 'director_business'::managerial_role, d.id, ur.user_id
FROM departments d
CROSS JOIN user_roles ur
WHERE d.slug IN ('sales', 'marketing', 'orders')
AND ur.department_role = 'sales'
AND ur.employee_type = 'manager'
LIMIT 1;

-- Director CX manages: Technology, Support, Learning, Projects  
INSERT INTO manager_assignments (role, department_id, user_id)
SELECT 'director_cx'::managerial_role, d.id, ur.user_id
FROM departments d
CROSS JOIN user_roles ur
WHERE d.slug IN ('technology', 'support', 'learning', 'projects')
AND ur.department_role = 'projects'
AND ur.employee_type = 'manager'
LIMIT 1;

-- Head Compliance manages: Legal, ISMS, QMS
INSERT INTO manager_assignments (role, department_id, user_id)
SELECT 'head_compliance'::managerial_role, d.id, ur.user_id
FROM departments d
CROSS JOIN user_roles ur
WHERE d.slug IN ('legal', 'isms', 'qms')
AND ur.employee_type = 'manager'
LIMIT 1;

-- Recreate employee-manager mappings for existing employees
TRUNCATE employee_manager_mapping CASCADE;

-- Map employees to their directors based on department
INSERT INTO employee_manager_mapping (employee_id, manager_id)
SELECT DISTINCT ur.user_id, ma.user_id
FROM user_roles ur
JOIN departments d ON ur.department_id = d.id
JOIN department_hierarchy dh ON d.id = dh.department_id
JOIN manager_assignments ma ON ma.role = dh.reports_to
WHERE ur.employee_type = 'employee'
AND ma.user_id IS NOT NULL;