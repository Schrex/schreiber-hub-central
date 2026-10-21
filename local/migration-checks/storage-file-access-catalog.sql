-- Metadata only. Use pinned CLI with explicit --linked --project-ref
-- acgqjjbrnkmeazswdnzp; never infer the target from tracked CLI configuration.
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;
WITH policies AS (
  SELECT policyname, permissive, roles::text, cmd, qual, with_check
  FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
), buckets AS (
  SELECT id, public, file_size_limit, allowed_mime_types
  FROM storage.buckets
)
SELECT jsonb_build_object(
  'database', current_database(), 'role', current_user,
  'objects_rls', (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass),
  'role_helper', (SELECT jsonb_build_object('fingerprint', md5(to_jsonb(h)::text), 'metadata', to_jsonb(h))
    FROM (SELECT md5(pg_get_functiondef(oid)) AS definition, proowner::regrole::text AS owner,
      prosecdef, proconfig, proacl::text FROM pg_proc
      WHERE oid='public.has_role(uuid,public.app_role)'::regprocedure) h),
  'policy_count', (SELECT count(*) FROM policies),
  'policy_fingerprint', (SELECT md5(jsonb_agg(to_jsonb(p) ORDER BY policyname)::text) FROM policies p),
  'bucket_fingerprint', (SELECT md5(jsonb_agg(to_jsonb(b) ORDER BY id)::text) FROM buckets b),
  'buckets', (SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM buckets b),
  'accident_policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM policies p
    WHERE coalesce(qual,'') LIKE '%accident-photos%' OR coalesce(with_check,'') LIKE '%accident-photos%'),
  'realtime_publication', (SELECT jsonb_agg(to_jsonb(p)) FROM (
    SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete, pubtruncate
    FROM pg_publication WHERE pubname='supabase_realtime') p),
  'realtime_tables', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename),'[]'::jsonb)
    FROM (SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime') p)
) AS catalog;
ROLLBACK;
