-- Fix security issue: Restrict departments table to authenticated users only
DROP POLICY IF EXISTS "Departments are readable" ON departments;

CREATE POLICY "Authenticated users can view departments" 
  ON departments FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- Backfill user_department_assignments from user_roles for existing users
INSERT INTO user_department_assignments (user_id, department_id)
SELECT DISTINCT user_id, department_id
FROM user_roles
WHERE department_id IS NOT NULL
ON CONFLICT (user_id, department_id) DO NOTHING;

-- Add unique constraint if not exists to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_department_assignments_user_id_department_id_key'
  ) THEN
    ALTER TABLE user_department_assignments 
    ADD CONSTRAINT user_department_assignments_user_id_department_id_key 
    UNIQUE (user_id, department_id);
  END IF;
END $$;