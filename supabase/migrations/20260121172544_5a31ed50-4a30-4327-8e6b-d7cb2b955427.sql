-- Add columns to waybills table for signed waybill tracking
ALTER TABLE public.waybills 
ADD COLUMN IF NOT EXISTS signed_waybill_path text,
ADD COLUMN IF NOT EXISTS signed_waybill_name text,
ADD COLUMN IF NOT EXISTS signed_at timestamptz,
ADD COLUMN IF NOT EXISTS signed_by uuid;