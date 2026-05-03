DO $$ BEGIN
  CREATE TYPE submittal_status AS ENUM ('pending','submitted','under_review','approved','revise_resubmit','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.job_submittals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  title text NOT NULL,
  status submittal_status NOT NULL DEFAULT 'pending',
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  notes text,
  submitted_at date,
  approved_at date,
  uploaded_by uuid,
  uploaded_by_name text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_submittals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Foreman office admin view submittals"
  ON public.job_submittals FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Office admin insert submittals"
  ON public.job_submittals FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Office admin update submittals"
  ON public.job_submittals FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Office admin delete submittals"
  ON public.job_submittals FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER update_job_submittals_updated_at
  BEFORE UPDATE ON public.job_submittals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_job_submittals_job ON public.job_submittals(job_id, sort_order);

INSERT INTO storage.buckets (id, name, public)
VALUES ('job-submittals','job-submittals',false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Foreman office admin view submittal files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='job-submittals' AND (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "Office admin upload submittal files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='job-submittals' AND (has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "Office admin update submittal files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='job-submittals' AND (has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "Office admin delete submittal files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='job-submittals' AND (has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role)));
