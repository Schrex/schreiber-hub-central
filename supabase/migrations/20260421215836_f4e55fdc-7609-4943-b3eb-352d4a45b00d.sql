-- Plans table: per-job plans organized by category
CREATE TYPE public.plan_category AS ENUM ('civil', 'structural', 'plumbing', 'electrical', 'architectural');

CREATE TABLE public.job_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  category public.plan_category NOT NULL,
  title TEXT NOT NULL,
  version TEXT,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_plans_job_category ON public.job_plans(job_id, category);

ALTER TABLE public.job_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view plans"
  ON public.job_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Foreman office admin insert plans"
  ON public.job_plans FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Foreman office admin update plans"
  ON public.job_plans FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Foreman office admin delete plans"
  ON public.job_plans FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER update_job_plans_updated_at
  BEFORE UPDATE ON public.job_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for plans (private; access via signed URLs)
INSERT INTO storage.buckets (id, name, public) VALUES ('job-plans', 'job-plans', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can read job plans"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'job-plans');

CREATE POLICY "Foreman office admin upload job plans"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-plans' AND (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "Foreman office admin update job plans"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'job-plans' AND (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "Foreman office admin delete job plans"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'job-plans' AND (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role)));