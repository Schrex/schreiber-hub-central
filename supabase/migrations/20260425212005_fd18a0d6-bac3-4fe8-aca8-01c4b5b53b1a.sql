ALTER TABLE public.job_permits
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('permits', 'permits', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone signed in can view permit files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'permits');

CREATE POLICY "Foreman office admin upload permit files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'permits' AND (
  has_role(auth.uid(), 'foreman'::app_role)
  OR has_role(auth.uid(), 'office'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
));

CREATE POLICY "Foreman office admin update permit files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'permits' AND (
  has_role(auth.uid(), 'foreman'::app_role)
  OR has_role(auth.uid(), 'office'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
));

CREATE POLICY "Foreman office admin delete permit files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'permits' AND (
  has_role(auth.uid(), 'foreman'::app_role)
  OR has_role(auth.uid(), 'office'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
));