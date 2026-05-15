CREATE POLICY "Foremen and admins can update talk-audio"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'talk-audio' AND (public.has_role(auth.uid(), 'foreman'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (bucket_id = 'talk-audio' AND (public.has_role(auth.uid(), 'foreman'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)));