CREATE TYPE public.job_status AS ENUM ('active', 'on_hold', 'complete');

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number TEXT,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status job_status NOT NULL DEFAULT 'active',
  customer TEXT,
  gc TEXT,
  on_site_contact_name TEXT,
  on_site_contact_phone TEXT,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Office and admin can insert jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Office and admin can update jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Office and admin can delete jobs"
  ON public.jobs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_jobs_status ON public.jobs(status);