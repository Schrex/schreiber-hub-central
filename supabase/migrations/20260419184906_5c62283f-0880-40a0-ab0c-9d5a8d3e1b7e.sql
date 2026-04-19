-- 1. is_driver flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_driver boolean NOT NULL DEFAULT false;

-- 2. dispatch order status enum
DO $$ BEGIN
  CREATE TYPE public.dispatch_status AS ENUM ('scheduled','in_progress','complete','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. dispatch_orders table
CREATE TABLE public.dispatch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/New_York')::date,
  driver_user_id uuid,
  driver_name text,
  truck_number text,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_name text,
  gc text,
  customer text,
  material text,
  pickup_location text,
  dump_location text,
  load_quantity numeric,
  start_time time,
  status public.dispatch_status NOT NULL DEFAULT 'scheduled',
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatch_orders_date ON public.dispatch_orders(dispatch_date);
CREATE INDEX idx_dispatch_orders_driver ON public.dispatch_orders(driver_user_id);

ALTER TABLE public.dispatch_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view dispatch orders"
  ON public.dispatch_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Office admin insert dispatch orders"
  ON public.dispatch_orders FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin'));

CREATE POLICY "Office admin update dispatch orders"
  ON public.dispatch_orders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin'));

CREATE POLICY "Office admin delete dispatch orders"
  ON public.dispatch_orders FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_dispatch_orders_updated_at
  BEFORE UPDATE ON public.dispatch_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();