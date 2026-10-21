-- Read-only; returns hashes of object paths and owners, never their raw values.
SELECT json_build_object(
 'objects',(SELECT json_agg(json_build_object(
  'key',encode(extensions.digest(bucket_id||chr(31)||name,'sha256'),'hex'),
  'owner',encode(extensions.digest(owner::text,'sha256'),'hex'),
  'owner_id',encode(extensions.digest(owner_id,'sha256'),'hex'),
  'mimetype',metadata->>'mimetype','cacheControl',metadata->>'cacheControl',
  'size',metadata->>'size','custom_metadata_empty',coalesce(user_metadata,'{}'::jsonb)='{}'::jsonb
 )) FROM storage.objects),
 'buckets',(SELECT json_agg(json_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types,'owner_empty',owner IS NULL AND owner_id IS NULL)) FROM storage.buckets),
 'storage_policies',(SELECT count(*) FROM pg_policies WHERE schemaname='storage')
);
