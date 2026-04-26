
-- 1. Drop the per-row equipment table; we'll store equipment as a text[] on each activity
DROP TABLE IF EXISTS public.activity_equipment;

-- 2. Reset phases & crews lookups to prototype values
DELETE FROM public.bid_item_activities;
DELETE FROM public.bid_item_materials;
DELETE FROM public.bid_items;
DELETE FROM public.bid_phases;
DELETE FROM public.crews;

-- Add color + short label to phases
ALTER TABLE public.bid_phases ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#6B7280';
ALTER TABLE public.bid_phases ADD COLUMN IF NOT EXISTS short_label text;

-- 3. bid_items: add subcontractor field
ALTER TABLE public.bid_items ADD COLUMN IF NOT EXISTS sub text;
-- item_code can repeat across jobs but should be unique within a job for keying
ALTER TABLE public.bid_items DROP CONSTRAINT IF EXISTS bid_items_job_code_key;
ALTER TABLE public.bid_items ADD CONSTRAINT bid_items_job_code_key UNIQUE (job_id, item_code);

-- 4. bid_item_activities: code/name/rate model + equipment as text[]
ALTER TABLE public.bid_item_activities ADD COLUMN IF NOT EXISTS code text NOT NULL DEFAULT '';
ALTER TABLE public.bid_item_activities ADD COLUMN IF NOT EXISTS qty numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bid_item_activities ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'EA';
ALTER TABLE public.bid_item_activities ADD COLUMN IF NOT EXISTS rate numeric;
ALTER TABLE public.bid_item_activities ADD COLUMN IF NOT EXISTS rate_by text NOT NULL DEFAULT 'hr';
ALTER TABLE public.bid_item_activities ADD COLUMN IF NOT EXISTS equipment text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.bid_item_activities ADD CONSTRAINT bia_rate_by_check CHECK (rate_by IN ('hr','shift','invHr'));
-- description column was the prototype's "name"; keep it but allow empty since name lives in description
-- Drop unused legacy cols
ALTER TABLE public.bid_item_activities DROP COLUMN IF EXISTS production_rate;
ALTER TABLE public.bid_item_activities DROP COLUMN IF EXISTS production_unit;

-- 5. Scope card tables, per job
CREATE TABLE public.job_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_notes_job ON public.job_notes(job_id);

CREATE TABLE public.job_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_exclusions_job ON public.job_exclusions(job_id);

CREATE TABLE public.job_unit_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL,
  price numeric NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_unit_pricing_job ON public.job_unit_pricing(job_id);

-- updated_at triggers
CREATE TRIGGER trg_job_notes_updated_at BEFORE UPDATE ON public.job_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_job_exclusions_updated_at BEFORE UPDATE ON public.job_exclusions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_job_unit_pricing_updated_at BEFORE UPDATE ON public.job_unit_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_unit_pricing ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_notes','job_exclusions','job_unit_pricing']
  LOOP
    EXECUTE format('CREATE POLICY "Anyone signed in can view %I" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "Office admin insert %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), ''office''::app_role) OR has_role(auth.uid(), ''admin''::app_role))', t, t);
    EXECUTE format('CREATE POLICY "Office admin update %I" ON public.%I FOR UPDATE TO authenticated USING (has_role(auth.uid(), ''office''::app_role) OR has_role(auth.uid(), ''admin''::app_role))', t, t);
    EXECUTE format('CREATE POLICY "Office admin delete %I" ON public.%I FOR DELETE TO authenticated USING (has_role(auth.uid(), ''office''::app_role) OR has_role(auth.uid(), ''admin''::app_role))', t, t);
  END LOOP;
END $$;
