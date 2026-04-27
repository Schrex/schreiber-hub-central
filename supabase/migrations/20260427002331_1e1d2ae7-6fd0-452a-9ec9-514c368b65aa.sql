-- Table to track uploaded estimate files per job
CREATE TABLE public.job_estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  notes TEXT,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view estimates"
ON public.job_estimates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Office admin insert estimates"
ON public.job_estimates FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin update estimates"
ON public.job_estimates FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin delete estimates"
ON public.job_estimates FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_job_estimates_updated_at
BEFORE UPDATE ON public.job_estimates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Private storage bucket for estimate files
INSERT INTO storage.buckets (id, name, public) VALUES ('job-estimates', 'job-estimates', false);

CREATE POLICY "Signed in can read estimate files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'job-estimates');

CREATE POLICY "Office admin upload estimate files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'job-estimates' AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Office admin update estimate files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'job-estimates' AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Office admin delete estimate files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'job-estimates' AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));