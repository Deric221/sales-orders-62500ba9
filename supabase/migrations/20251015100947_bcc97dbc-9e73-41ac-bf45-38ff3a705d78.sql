-- Add file storage fields to waybills table
ALTER TABLE public.waybills 
ADD COLUMN file_path text,
ADD COLUMN file_name text;