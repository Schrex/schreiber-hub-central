
CREATE TABLE public.job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  file_size bigint,
  caption text,
  taken_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/New_York'::text))::date,
  uploaded_by uuid,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_photos_job_date ON public.job_photos(job_id, taken_on DESC, created_at DESC);

ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view job photos"
ON public.job_photos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Foreman office admin insert job photos"
ON public.job_photos FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin'));

CREATE POLICY "Foreman office admin update job photos"
ON public.job_photos FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin'));

CREATE POLICY "Foreman office admin delete job photos"
ON public.job_photos FOR DELETE TO authenticated
USING (has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin'));

CREATE TRIGGER update_job_photos_updated_at
BEFORE UPDATE ON public.job_photos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public) VALUES ('job-photos','job-photos', false);

CREATE POLICY "Signed in can read job photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'job-photos');

CREATE POLICY "Foreman office admin upload job photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'job-photos' AND (has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin')));

CREATE POLICY "Foreman office admin update job photo files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'job-photos' AND (has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin')));

CREATE POLICY "Foreman office admin delete job photo files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'job-photos' AND (has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin')));
