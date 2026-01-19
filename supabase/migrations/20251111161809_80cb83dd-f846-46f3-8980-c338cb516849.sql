-- Security fix: Remove duplicate SELECT policy on profiles table
-- Keep only "Profiles are viewable by self, managers, finance, admins" as the single policy

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;