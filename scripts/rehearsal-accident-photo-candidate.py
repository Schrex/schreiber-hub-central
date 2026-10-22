#!/usr/bin/env python3
"""Prepare SQL only. Does not execute SQL or contact any backend.

Root must use pinned CLI db query --linked --project-ref acgqjjbrnkmeazswdnzp
for each selected file. SQL catalog guards detect drift, not project identity;
the explicit CLI project ref is mandatory. Never use the source project's ref.
"""
from pathlib import Path
import hashlib
import tempfile

ROOT = Path(__file__).resolve().parent.parent
CANDIDATE = ROOT / 'local/candidate-migrations/20261021010000_accident_photo_replacement.sql'
CANDIDATE_SHA = '01ca86b09c07d8a5785fbdc4aa3dbad659004d5b268693df64fa5a6e37dfc6e8'
POLICY = 'Office admin replaces existing accident photos'
# Metadata-only destination audit on 2026-10-21. Hashes contain no business data.
BASELINE = '2b0533af7f188e7b64fc23c6b055e566'
BUCKETS = '088ed3c76b264aaaa5e470c0dd3b3cd4'
NEW_POLICY = 'ad6944e27d37162de19accb8bf542163'
ROLE_HELPER = 'f2a1864de98b6adda509060901001bd3'
POLICIES_SQL = '''SELECT policyname,permissive,roles::text,cmd,qual,with_check
FROM pg_policies WHERE schemaname='storage' AND tablename='objects' '''


def guard(installed):
    """All original policies and bucket flags/limits must remain exact."""
    return f'''DO $guard$ BEGIN
 IF current_user <> 'postgres' OR current_database() <> 'postgres' THEN
   RAISE EXCEPTION 'Unexpected database role'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
   RAISE EXCEPTION 'Storage RLS is disabled'; END IF;
 IF (SELECT md5(to_jsonb(h)::text) FROM
   (SELECT md5(pg_get_functiondef(oid)) AS definition, proowner::regrole::text AS owner,
     prosecdef,proconfig,proacl::text FROM pg_proc
     WHERE oid='public.has_role(uuid,public.app_role)'::regprocedure) h) IS DISTINCT FROM '{ROLE_HELPER}' THEN
   RAISE EXCEPTION 'Role helper definition, ownership or grants drifted'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects') <> {58 if installed else 57} THEN
   RAISE EXCEPTION 'Unexpected Storage policy count'; END IF;
 IF (SELECT md5(jsonb_agg(to_jsonb(p) ORDER BY policyname)::text) FROM
   ({POLICIES_SQL} AND policyname <> '{POLICY}') p) IS DISTINCT FROM '{BASELINE}' THEN
   RAISE EXCEPTION 'Original Storage policies drifted'; END IF;
 IF (SELECT md5(jsonb_agg(to_jsonb(b) ORDER BY id)::text) FROM
   (SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets) b) IS DISTINCT FROM '{BUCKETS}' THEN
   RAISE EXCEPTION 'Private bucket metadata drifted'; END IF;
 IF (SELECT md5(to_jsonb(p)::text) FROM
   ({POLICIES_SQL} AND policyname='{POLICY}') p) IS DISTINCT FROM {f"'{NEW_POLICY}'" if installed else 'NULL'} THEN
   RAISE EXCEPTION 'Replacement policy differs from expected state'; END IF;
END $guard$;
'''


def prepare():
    candidate = CANDIDATE.read_text()
    if hashlib.sha256(candidate.encode()).hexdigest() != CANDIDATE_SHA:
        raise ValueError('Reviewed candidate changed; review before regenerating SQL')
    preamble = '''-- Fixed destination acgqjjbrnkmeazswdnzp only; use explicit CLI project ref.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(19761021,1);
'''
    # Lock serializes policy changes during validation/application. Existing file
    # requests may briefly wait; bounded lock_timeout refuses prolonged blocking.
    mutation = preamble + 'LOCK TABLE storage.objects IN SHARE ROW EXCLUSIVE MODE;\n'
    apply = mutation + guard(False) + candidate + '\n' + guard(True) + "SELECT 'PASS exact replacement policy installed; original policies/buckets preserved' AS result;\nCOMMIT;\n"
    rollback = mutation + guard(True) + f'DROP POLICY "{POLICY}" ON storage.objects;\n' + guard(False) + "SELECT 'PASS original Storage policy catalog restored' AS result;\nCOMMIT;\n"
    verify = 'BEGIN READ ONLY;\nSET LOCAL search_path=pg_catalog;\n' + guard(True) + "SELECT 'PASS exact candidate and unchanged original policies/private buckets' AS result;\nROLLBACK;\n"
    return {'apply.sql': apply, 'verify.sql': verify, 'rollback.sql': rollback}


if __name__ == '__main__':
    out = Path(tempfile.mkdtemp(prefix='schreiber-accident-policy-'))
    for filename, sql in prepare().items():
        (out / filename).write_text(sql)
    print(out)
