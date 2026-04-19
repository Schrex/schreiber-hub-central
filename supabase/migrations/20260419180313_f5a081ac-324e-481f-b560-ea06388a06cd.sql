-- Catalog of available apparel
CREATE TABLE public.clothing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sizes text[] NOT NULL DEFAULT ARRAY['S','M','L','XL','2XL','3XL'],
  colors text[] NOT NULL DEFAULT ARRAY['Black'],
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clothing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view active items"
  ON public.clothing_items FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office and admin can insert items"
  ON public.clothing_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office and admin can update items"
  ON public.clothing_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office and admin can delete items"
  ON public.clothing_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_clothing_items_updated_at
  BEFORE UPDATE ON public.clothing_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Order status enum
CREATE TYPE public.clothing_order_status AS ENUM ('requested','ordered','received','distributed','cancelled');

-- Orders
CREATE TABLE public.clothing_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.clothing_items(id) ON DELETE RESTRICT,
  item_name text NOT NULL,
  size text NOT NULL,
  color text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 50),
  notes text,
  status public.clothing_order_status NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clothing_orders_user ON public.clothing_orders(user_id);
CREATE INDEX idx_clothing_orders_status ON public.clothing_orders(status);

ALTER TABLE public.clothing_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders"
  ON public.clothing_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Office and admin view all orders"
  ON public.clothing_orders FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users create own orders"
  ON public.clothing_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own pending orders"
  ON public.clothing_orders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'requested');

CREATE POLICY "Office and admin update any order"
  ON public.clothing_orders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own pending orders"
  ON public.clothing_orders FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'requested');

CREATE POLICY "Office and admin delete any order"
  ON public.clothing_orders FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_clothing_orders_updated_at
  BEFORE UPDATE ON public.clothing_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed standard catalog
INSERT INTO public.clothing_items (name, description, sizes, colors, sort_order) VALUES
  ('T-Shirt', 'Schreiber logo work shirt', ARRAY['S','M','L','XL','2XL','3XL'], ARRAY['Black','Gray','Safety Yellow'], 1),
  ('Hoodie', 'Pullover hoodie with logo', ARRAY['S','M','L','XL','2XL','3XL'], ARRAY['Black','Gray','Navy'], 2),
  ('Hat', 'Logo cap', ARRAY['One Size'], ARRAY['Black','Gray','Camo','Safety Orange'], 3),
  ('Jacket', 'Insulated work jacket', ARRAY['S','M','L','XL','2XL','3XL'], ARRAY['Black','Safety Yellow'], 4),
  ('Hi-Vis Vest', 'ANSI Class 2 safety vest', ARRAY['S/M','L/XL','2XL/3XL'], ARRAY['Safety Yellow','Safety Orange'], 5);