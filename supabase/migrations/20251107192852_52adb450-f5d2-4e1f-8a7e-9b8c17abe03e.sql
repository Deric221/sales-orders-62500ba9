-- Drop existing policies on expense-retirements bucket if they exist
drop policy if exists "Retirements: owner can upload" on storage.objects;
drop policy if exists "Retirements: owner, finance, admin can read" on storage.objects;

-- Storage policies for expense-retirements bucket
-- Allow upload by owner (user id must match first folder segment)
create policy "Retirements: owner can upload"
on storage.objects
for insert
with check (
  bucket_id = 'expense-retirements'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow download by owner, finance, and admin
create policy "Retirements: owner, finance, admin can read"
on storage.objects
for select
using (
  bucket_id = 'expense-retirements'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.has_department_role(auth.uid(), 'finance')
    or public.has_department_role(auth.uid(), 'admin')
  )
);