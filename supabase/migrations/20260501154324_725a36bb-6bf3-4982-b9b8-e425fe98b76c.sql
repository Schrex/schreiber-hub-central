-- Status enums
CREATE TYPE public.equipment_rental_status AS ENUM ('requested', 'approved', 'denied', 'picked_up', 'returned', 'cancelled');
CREATE TYPE public.shop_reservation_status AS ENUM ('requested', 'approved', 'denied', 'completed', 'cancelled');

-- Equipment catalog
CREATE TABLE public.equipment_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  daily_rate numeric,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view active equipment"
  ON public.equipment_items FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin insert equipment"
  ON public.equipment_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin update equipment"
  ON public.equipment_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin delete equipment"
  ON public.equipment_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_equipment_items_updated_at
  BEFORE UPDATE ON public.equipment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Equipment rentals (with waiver)
CREATE TABLE public.equipment_rentals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  equipment_id uuid NOT NULL,
  equipment_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  status public.equipment_rental_status NOT NULL DEFAULT 'requested',
  waiver_name text NOT NULL,
  waiver_signature_path text NOT NULL,
  waiver_text text NOT NULL,
  waiver_agreed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rentals"
  ON public.equipment_rentals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Office admin view all rentals"
  ON public.equipment_rentals FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users create own rentals"
  ON public.equipment_rentals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own pending rentals"
  ON public.equipment_rentals FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'requested');

CREATE POLICY "Office admin update any rental"
  ON public.equipment_rentals FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own pending rentals"
  ON public.equipment_rentals FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'requested');

CREATE POLICY "Office admin delete any rental"
  ON public.equipment_rentals FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_equipment_rentals_updated_at
  BEFORE UPDATE ON public.equipment_rentals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validation: end_date must be on or after start_date
CREATE OR REPLACE FUNCTION public.validate_equipment_rental()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date must be on or after start_date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_equipment_rental_trigger
  BEFORE INSERT OR UPDATE ON public.equipment_rentals
  FOR EACH ROW EXECUTE FUNCTION public.validate_equipment_rental();

-- Shop reservations (day reservation)
CREATE TABLE public.shop_reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  reserved_date date NOT NULL,
  purpose text NOT NULL,
  notes text,
  status public.shop_reservation_status NOT NULL DEFAULT 'requested',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own shop reservations"
  ON public.shop_reservations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Office admin view all shop reservations"
  ON public.shop_reservations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users create own shop reservations"
  ON public.shop_reservations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own pending shop reservations"
  ON public.shop_reservations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'requested');

CREATE POLICY "Office admin update any shop reservation"
  ON public.shop_reservations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own pending shop reservations"
  ON public.shop_reservations FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'requested');

CREATE POLICY "Office admin delete any shop reservation"
  ON public.shop_reservations FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_shop_reservations_updated_at
  BEFORE UPDATE ON public.shop_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for waiver signatures
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-waivers', 'shop-waivers', false);

CREATE POLICY "Users upload own waiver signatures"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-waivers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view own waiver signatures"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shop-waivers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Office admin view all waiver signatures"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shop-waivers' AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));