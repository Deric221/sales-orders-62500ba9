-- Add Marketing department if not exists
INSERT INTO departments (name, slug)
VALUES ('Marketing', 'marketing')
ON CONFLICT (name) DO NOTHING;

-- Fix department hierarchy mappings according to specifications:
-- Director of Finance: Finance, HR & Admin, Infotech
-- Director of Business: Sales, Marketing, Orders
-- Director CX: Data Services, Projects
-- Head of Compliance: Compliance

-- Update HR & Admin to report to Director Finance
UPDATE department_hierarchy 
SET reports_to = 'director_finance'
WHERE department_id = (SELECT id FROM departments WHERE slug = 'hr-admin');

-- Update Infotech to report to Director Finance
UPDATE department_hierarchy 
SET reports_to = 'director_finance'
WHERE department_id = (SELECT id FROM departments WHERE slug = 'infotech');

-- Update Data Services to report to Director CX
UPDATE department_hierarchy 
SET reports_to = 'director_cx'
WHERE department_id = (SELECT id FROM departments WHERE slug = 'data-services');

-- Update Projects to report to Director CX
UPDATE department_hierarchy 
SET reports_to = 'director_cx'
WHERE department_id = (SELECT id FROM departments WHERE slug = 'projects');

-- Add Marketing department hierarchy (reports to Director Business)
INSERT INTO department_hierarchy (department_id, reports_to)
SELECT id, 'director_business'::managerial_role
FROM departments 
WHERE slug = 'marketing'
ON CONFLICT (department_id) DO UPDATE SET reports_to = 'director_business';

-- Remove Admin department from hierarchy if not needed (it wasn't in user specs)
-- Or reassign to appropriate manager - keeping as director_cx for now