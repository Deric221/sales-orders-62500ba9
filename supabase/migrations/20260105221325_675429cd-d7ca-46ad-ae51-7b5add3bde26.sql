-- ============================================
-- EXPENSE TICKETING ENHANCEMENTS
-- ============================================

-- Add reconciliation and refund fields to expense_tickets
ALTER TABLE public.expense_tickets
ADD COLUMN IF NOT EXISTS amount_requested numeric,
ADD COLUMN IF NOT EXISTS actual_amount_spent numeric,
ADD COLUMN IF NOT EXISTS remaining_balance numeric GENERATED ALWAYS AS (COALESCE(amount_requested, 0) - COALESCE(actual_amount_spent, 0)) STORED,
ADD COLUMN IF NOT EXISTS refund_status text DEFAULT 'no_refund_required' CHECK (refund_status IN ('no_refund_required', 'refund_pending', 'refund_returned')),
ADD COLUMN IF NOT EXISTS refund_confirmed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS refund_confirmed_by uuid;

-- ============================================
-- WAYBILL ITEM TRACKING TABLE
-- ============================================

-- Create waybill_items table for detailed item tracking
CREATE TABLE IF NOT EXISTS public.waybill_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waybill_id uuid REFERENCES public.waybills(id) ON DELETE CASCADE,
  company_po_id uuid REFERENCES public.company_pos(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  reference text,
  serial_number text,
  description text NOT NULL,
  items_received integer DEFAULT 0,
  items_outstanding integer GENERATED ALWAYS AS (quantity - COALESCE(items_received, 0)) STORED,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- DELIVERY TRACKING
-- ============================================

-- Add delivery status to waybills
ALTER TABLE public.waybills
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'partially_delivered', 'fully_delivered')),
ADD COLUMN IF NOT EXISTS total_items_ordered integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_items_delivered integer DEFAULT 0;

-- Create delivery records table for tracking partial deliveries
CREATE TABLE IF NOT EXISTS public.delivery_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waybill_id uuid NOT NULL REFERENCES public.waybills(id) ON DELETE CASCADE,
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  delivery_notes text,
  delivered_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Create delivery items table for items per delivery batch
CREATE TABLE IF NOT EXISTS public.delivery_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_record_id uuid NOT NULL REFERENCES public.delivery_records(id) ON DELETE CASCADE,
  waybill_item_id uuid NOT NULL REFERENCES public.waybill_items(id) ON DELETE CASCADE,
  quantity_delivered integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new tables
ALTER TABLE public.waybill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

-- Waybill items policies
CREATE POLICY "Orders Finance Projects can view waybill items"
ON public.waybill_items FOR SELECT
USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR
  has_department_role(auth.uid(), 'finance'::app_role_new) OR
  has_department_role(auth.uid(), 'projects'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can manage waybill items"
ON public.waybill_items FOR ALL
USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Delivery records policies
CREATE POLICY "Orders Finance Projects can view delivery records"
ON public.delivery_records FOR SELECT
USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR
  has_department_role(auth.uid(), 'finance'::app_role_new) OR
  has_department_role(auth.uid(), 'projects'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can manage delivery records"
ON public.delivery_records FOR ALL
USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- Delivery items policies
CREATE POLICY "Orders Finance Projects can view delivery items"
ON public.delivery_items FOR SELECT
USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR
  has_department_role(auth.uid(), 'finance'::app_role_new) OR
  has_department_role(auth.uid(), 'projects'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

CREATE POLICY "Orders can manage delivery items"
ON public.delivery_items FOR ALL
USING (
  has_department_role(auth.uid(), 'orders'::app_role_new) OR
  has_department_role(auth.uid(), 'admin'::app_role_new)
);

-- ============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Function to update waybill delivery status
CREATE OR REPLACE FUNCTION public.update_waybill_delivery_status()
RETURNS TRIGGER AS $$
DECLARE
  total_ordered integer;
  total_delivered integer;
  new_status text;
BEGIN
  -- Calculate totals
  SELECT 
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(items_received), 0)
  INTO total_ordered, total_delivered
  FROM public.waybill_items
  WHERE waybill_id = NEW.waybill_id;

  -- Determine status
  IF total_delivered = 0 THEN
    new_status := 'pending';
  ELSIF total_delivered >= total_ordered THEN
    new_status := 'fully_delivered';
  ELSE
    new_status := 'partially_delivered';
  END IF;

  -- Update waybill
  UPDATE public.waybills
  SET 
    delivery_status = new_status,
    total_items_ordered = total_ordered,
    total_items_delivered = total_delivered,
    updated_at = now()
  WHERE id = NEW.waybill_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for waybill_items changes
CREATE TRIGGER update_waybill_delivery_status_trigger
AFTER INSERT OR UPDATE ON public.waybill_items
FOR EACH ROW
EXECUTE FUNCTION public.update_waybill_delivery_status();

-- Function to update waybill item received count from delivery items
CREATE OR REPLACE FUNCTION public.update_waybill_item_received()
RETURNS TRIGGER AS $$
DECLARE
  total_received integer;
  target_waybill_id uuid;
BEGIN
  -- Calculate total received for this waybill item
  SELECT COALESCE(SUM(quantity_delivered), 0)
  INTO total_received
  FROM public.delivery_items
  WHERE waybill_item_id = NEW.waybill_item_id;

  -- Update the waybill item
  UPDATE public.waybill_items
  SET items_received = total_received, updated_at = now()
  WHERE id = NEW.waybill_item_id
  RETURNING waybill_id INTO target_waybill_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for delivery_items changes
CREATE TRIGGER update_waybill_item_received_trigger
AFTER INSERT OR UPDATE ON public.delivery_items
FOR EACH ROW
EXECUTE FUNCTION public.update_waybill_item_received();