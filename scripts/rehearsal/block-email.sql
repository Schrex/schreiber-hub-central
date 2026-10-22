-- REHEARSAL ONLY: install through the verified hub-rehearsal connection.
-- Configure Auth Send Email hook to rehearsal_guard.block_email afterwards.
BEGIN;
CREATE SCHEMA rehearsal_guard;
REVOKE ALL ON SCHEMA rehearsal_guard FROM PUBLIC, anon, authenticated;
CREATE FUNCTION rehearsal_guard.block_email(event jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT '{"error":{"http_code":403,"message":"Email delivery blocked during migration rehearsal"}}'::jsonb $$;
REVOKE ALL ON FUNCTION rehearsal_guard.block_email(jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA rehearsal_guard TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION rehearsal_guard.block_email(jsonb) TO supabase_auth_admin;
COMMIT;
