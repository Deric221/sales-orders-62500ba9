-- Add new roles to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'employee';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';