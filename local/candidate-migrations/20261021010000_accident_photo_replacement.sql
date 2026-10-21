-- REVIEW CANDIDATE ONLY. Not part of production migration replay.
-- Storage v1.82.1 replacement uses INSERT ... ON CONFLICT UPDATE for its
-- authorization probe. The existing office/admin UPDATE policy alone cannot
-- authorize replacing another reporter's photo because INSERT is own-folder only.
-- Allow that INSERT probe only when the exact object already exists and is
-- visible through existing SELECT policies. New other-user paths remain denied.
-- Keep the original owner-only upload and office/admin UPDATE policies intact.
CREATE POLICY "Office admin replaces existing accident photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'accident-photos'
  AND (public.has_role(auth.uid(), 'office'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role))
  AND EXISTS (
    SELECT 1 FROM storage.objects AS existing_photo
    WHERE existing_photo.bucket_id = objects.bucket_id
      AND existing_photo.name = objects.name
  )
);
