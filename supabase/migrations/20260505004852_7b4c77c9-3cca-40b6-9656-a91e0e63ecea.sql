
-- 1. Extend job_contacts
ALTER TABLE public.job_contacts
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS role_label text,
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS vendor_id uuid,
  ADD COLUMN IF NOT EXISTS employee_contact_id uuid,
  ADD COLUMN IF NOT EXISTS is_template_slot boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_job_contacts_category ON public.job_contacts(job_id, category, sort_order);

-- 2. Template slots reference table
CREATE TABLE IF NOT EXISTS public.job_contact_template_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  role_label text NOT NULL,
  material text,
  default_name text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_contact_template_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone signed in view template slots" ON public.job_contact_template_slots;
CREATE POLICY "Anyone signed in view template slots" ON public.job_contact_template_slots
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Office admin manage template slots" ON public.job_contact_template_slots;
CREATE POLICY "Office admin manage template slots" ON public.job_contact_template_slots
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER update_jcts_updated_at BEFORE UPDATE ON public.job_contact_template_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Seed template slots
INSERT INTO public.job_contact_template_slots (category, role_label, material, default_name, sort_order) VALUES
  -- GC
  ('GC', 'GC Project Manager', NULL, NULL, 10),
  ('GC', 'GC Superintendent', NULL, NULL, 20),
  -- Schreiber
  ('Schreiber', 'Project Lead', NULL, NULL, 110),
  ('Schreiber', 'Project Management', NULL, NULL, 120),
  ('Schreiber', 'Safety Representative', NULL, 'Michael Fragassi', 130),
  ('Schreiber', 'Safety 3rd Party', NULL, NULL, 140),
  -- External Partners
  ('External Partners', 'Engineering Firm', NULL, NULL, 210),
  ('External Partners', 'Architect', NULL, NULL, 220),
  ('External Partners', 'Surveyor', NULL, NULL, 230),
  -- Inspectors
  ('Inspectors', 'DOT Inspector', NULL, NULL, 310),
  ('Inspectors', 'Town/City Inspector', NULL, NULL, 320),
  ('Inspectors', 'County Inspector', NULL, NULL, 330),
  ('Inspectors', 'Building Inspector', NULL, NULL, 340),
  ('Inspectors', 'Testing Agency', NULL, NULL, 350),
  -- Suppliers
  ('Suppliers', 'Aggregate Supplier', 'Aggregates Type 1', NULL, 410),
  ('Suppliers', 'Aggregate Supplier', 'Aggregates Type 2', NULL, 420),
  ('Suppliers', 'Aggregate Supplier', 'Aggregates Type 3', NULL, 430),
  ('Suppliers', 'Aggregate Supplier', 'Aggregates Type 4', NULL, 440),
  ('Suppliers', 'Aggregate Supplier', 'Aggregates Type 5', NULL, 450),
  ('Suppliers', 'Supplier', 'Structural Fill', NULL, 460),
  ('Suppliers', 'Concrete Supplier', 'Concrete', NULL, 470),
  ('Suppliers', 'Dump Site', 'Dump Site', NULL, 480),
  ('Suppliers', 'Asphalt Supplier', 'Asphalt', NULL, 490),
  ('Suppliers', 'Supplier', 'Structures', NULL, 500),
  ('Suppliers', 'Supplier', 'Pipe', NULL, 510),
  ('Suppliers', 'Supplier', 'Signs', NULL, 520),
  ('Suppliers', 'Supplier', 'Frame and Grates', NULL, 530),
  ('Suppliers', 'Supplier', 'Reinforcement — Mesh', NULL, 540),
  ('Suppliers', 'Supplier', 'Reinforcement — Dowels', NULL, 550),
  ('Suppliers', 'Supplier', 'Misc Metals', NULL, 560),
  ('Suppliers', 'Supplier', 'Concrete — D Stakes', NULL, 570),
  ('Suppliers', 'Supplier', 'Concrete — Expansion Board', NULL, 580),
  ('Suppliers', 'Supplier', 'Concrete Sealer', NULL, 590),
  -- Subcontractors
  ('Subcontractors', 'Paving', NULL, NULL, 610),
  ('Subcontractors', 'Landscaping & Seeding', NULL, NULL, 620),
  ('Subcontractors', 'GPS Model', NULL, NULL, 630),
  ('Subcontractors', 'Water Tap', NULL, NULL, 640),
  ('Subcontractors', 'Sanitary Testing', NULL, NULL, 650),
  ('Subcontractors', 'Concrete Curb/Gutter Machine', NULL, NULL, 660),
  ('Subcontractors', 'Striping', NULL, NULL, 670),
  ('Subcontractors', 'Trucking', NULL, NULL, 680)
ON CONFLICT DO NOTHING;

-- 4. Function to seed slots for a job
CREATE OR REPLACE FUNCTION public.seed_job_contact_slots(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.job_contacts (job_id, name, category, role_label, material, sort_order, is_template_slot)
  SELECT _job_id, COALESCE(s.default_name, ''), s.category, s.role_label, s.material, s.sort_order, true
  FROM public.job_contact_template_slots s
  WHERE s.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.job_contacts c
      WHERE c.job_id = _job_id AND c.is_template_slot = true
        AND c.category = s.category AND c.role_label = s.role_label
        AND COALESCE(c.material,'') = COALESCE(s.material,'')
    );
END;
$$;

-- Allow name='' for template slot rows (drop NOT NULL would break; instead default is fine)
ALTER TABLE public.job_contacts ALTER COLUMN name DROP NOT NULL;

-- 5. Trigger on jobs insert
CREATE OR REPLACE FUNCTION public.trg_seed_job_contact_slots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_job_contact_slots(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_seed_contact_slots ON public.jobs;
CREATE TRIGGER jobs_seed_contact_slots
  AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_job_contact_slots();

-- 6. Backfill existing jobs
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT id FROM public.jobs LOOP
    PERFORM public.seed_job_contact_slots(j.id);
  END LOOP;
END $$;
