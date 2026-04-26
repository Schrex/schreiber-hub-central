
-- Global lookup: bid phases
CREATE TABLE public.bid_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Global lookup: crews
CREATE TABLE public.crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL,
  size integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bid items per job
CREATE TABLE public.bid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.bid_phases(id) ON DELETE SET NULL,
  item_code text NOT NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'EA',
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bid_items_job ON public.bid_items(job_id);
CREATE INDEX idx_bid_items_phase ON public.bid_items(phase_id);

-- Activities under each bid item
CREATE TABLE public.bid_item_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_item_id uuid NOT NULL REFERENCES public.bid_items(id) ON DELETE CASCADE,
  crew_id uuid REFERENCES public.crews(id) ON DELETE SET NULL,
  description text NOT NULL,
  production_rate numeric,
  production_unit text,
  manhours numeric NOT NULL DEFAULT 0,
  shifts numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bia_bid_item ON public.bid_item_activities(bid_item_id);

-- Equipment/resources per activity
CREATE TABLE public.activity_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.bid_item_activities(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL,
  share_of_shift numeric NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ae_activity ON public.activity_equipment(activity_id);

-- Materials per bid item
CREATE TABLE public.bid_item_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_item_id uuid NOT NULL REFERENCES public.bid_items(id) ON DELETE CASCADE,
  vendor text,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'EA',
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bim_bid_item ON public.bid_item_materials(bid_item_id);

-- Updated_at triggers
CREATE TRIGGER trg_bid_phases_updated_at BEFORE UPDATE ON public.bid_phases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_crews_updated_at BEFORE UPDATE ON public.crews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bid_items_updated_at BEFORE UPDATE ON public.bid_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bid_item_activities_updated_at BEFORE UPDATE ON public.bid_item_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bid_item_materials_updated_at BEFORE UPDATE ON public.bid_item_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.bid_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_item_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_item_materials ENABLE ROW LEVEL SECURITY;

-- Policies: signed-in read, office+admin write (consistent across all 6 tables)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bid_phases','crews','bid_items','bid_item_activities','activity_equipment','bid_item_materials']
  LOOP
    EXECUTE format('CREATE POLICY "Anyone signed in can view %I" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "Office admin insert %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), ''office''::app_role) OR has_role(auth.uid(), ''admin''::app_role))', t, t);
    EXECUTE format('CREATE POLICY "Office admin update %I" ON public.%I FOR UPDATE TO authenticated USING (has_role(auth.uid(), ''office''::app_role) OR has_role(auth.uid(), ''admin''::app_role))', t, t);
    EXECUTE format('CREATE POLICY "Office admin delete %I" ON public.%I FOR DELETE TO authenticated USING (has_role(auth.uid(), ''office''::app_role) OR has_role(auth.uid(), ''admin''::app_role))', t, t);
  END LOOP;
END $$;
