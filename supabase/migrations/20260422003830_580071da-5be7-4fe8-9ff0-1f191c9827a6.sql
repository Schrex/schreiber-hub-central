CREATE TYPE public.dispatch_rate_type AS ENUM ('hourly', 'per_load', 'per_ton', 'flat', 'other');
CREATE TYPE public.dispatch_invoice_status AS ENUM ('not_billed', 'billed', 'paid');

ALTER TABLE public.dispatch_orders
  ADD COLUMN bill_to text,
  ADD COLUMN po_number text,
  ADD COLUMN rate_type public.dispatch_rate_type,
  ADD COLUMN rate_amount numeric,
  ADD COLUMN billed_quantity numeric,
  ADD COLUMN billing_total numeric GENERATED ALWAYS AS (COALESCE(rate_amount,0) * COALESCE(billed_quantity,0)) STORED,
  ADD COLUMN invoice_status public.dispatch_invoice_status NOT NULL DEFAULT 'not_billed',
  ADD COLUMN billing_notes text;