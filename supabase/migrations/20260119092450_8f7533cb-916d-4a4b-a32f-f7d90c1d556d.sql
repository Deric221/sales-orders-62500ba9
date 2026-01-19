-- Create trigger on auth.users to handle new user profile creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Sync existing users from auth.users to profiles table
INSERT INTO public.profiles (id, email, full_name)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email) as full_name
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

-- Also ensure user_roles exist for all auth users
INSERT INTO public.user_roles (user_id, employee_type)
SELECT id, 'employee'::employee_type
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id) DO NOTHING;