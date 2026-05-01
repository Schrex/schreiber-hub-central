ALTER TABLE public.toolbox_talks
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS voice_script text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('talk-media', 'talk-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read talk-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'talk-media');

CREATE POLICY "Admins write talk-media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'talk-media' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update talk-media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'talk-media' AND has_role(auth.uid(), 'admin'::app_role));