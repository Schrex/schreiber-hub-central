-- Metadata-only destination audit. Run only with explicit project ref
-- acgqjjbrnkmeazswdnzp; does not read file paths, employee rows or credentials.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
DO $check$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='talk-media' AND NOT public) THEN
  RAISE EXCEPTION 'talk-media bucket not private'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
  RAISE EXCEPTION 'Storage objects RLS disabled'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
     AND (coalesce(qual,'') LIKE '%talk-media%' OR coalesce(with_check,'') LIKE '%talk-media%')) <> 3 THEN
  RAISE EXCEPTION 'Unexpected talk-media policy inventory'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
     AND policyname='Signed-in read talk-media' AND cmd='SELECT' AND roles='{authenticated}'
     AND qual=$q$(bucket_id = 'talk-media'::text)$q$) THEN
  RAISE EXCEPTION 'Expected authenticated read policy missing'; END IF;
END $check$;
SELECT policyname,cmd,roles,qual,with_check FROM pg_policies
 WHERE schemaname='storage' AND tablename='objects'
 AND (coalesce(qual,'') LIKE '%talk-media%' OR coalesce(with_check,'') LIKE '%talk-media%')
 ORDER BY policyname;
ROLLBACK;
