-- Contract: single file per job stored on jobs table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS contract_file_path text,
  ADD COLUMN IF NOT EXISTS contract_file_name text,
  ADD COLUMN IF NOT EXISTS contract_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_uploaded_by uuid;

-- Scope of work line items
CREATE TABLE IF NOT EXISTS public.job_scope_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_scope_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view job_scope_items"
  ON public.job_scope_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Office admin insert job_scope_items"
  ON public.job_scope_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin update job_scope_items"
  ON public.job_scope_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin delete job_scope_items"
  ON public.job_scope_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_job_scope_items_updated_at
  BEFORE UPDATE ON public.job_scope_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_job_scope_items_job ON public.job_scope_items(job_id, sort_order);

-- Contracts storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-contracts', 'job-contracts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can view contracts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'job-contracts');

CREATE POLICY "Office admin upload contracts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-contracts' AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Office admin update contracts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'job-contracts' AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Office admin delete contracts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'job-contracts' AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));
