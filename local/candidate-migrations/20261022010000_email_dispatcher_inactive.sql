-- REVIEW CANDIDATE ONLY. Not part of application migration replay.
-- Install only on acgqjjbrnkmeazswdnzp after controlled mail proof and review.
-- Operator explicitly sets migration.destination_project_ref in this session.
-- Requires previously reviewed pg_cron, pg_net and Vault installation.
-- Does not create a secret, enable delivery, or make a network request.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $install$
DECLARE job_id bigint;
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres' OR
    current_setting('migration.destination_project_ref', true) IS DISTINCT FROM 'acgqjjbrnkmeazswdnzp' THEN
    RAISE EXCEPTION 'Explicit destination/operator preflight required';
  END IF;
  IF (SELECT count(*) FROM pg_extension WHERE extname IN ('pg_cron','pg_net','supabase_vault')) <> 3 THEN
    RAISE EXCEPTION 'Reviewed cron/net/Vault prerequisites required';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='schreiber-email-dispatch') THEN
    RAISE EXCEPTION 'Dispatcher already exists; inspect without overwriting';
  END IF;
  job_id := cron.schedule('schreiber-email-dispatch', '* * * * *', $command$
    DO $dispatch$
    DECLARE worker_token text;
    BEGIN
      SELECT decrypted_secret INTO STRICT worker_token FROM vault.decrypted_secrets
        WHERE name='schreiber_email_worker_auth_token';
      IF coalesce(worker_token,'')='' THEN RAISE EXCEPTION 'Dispatcher credential missing'; END IF;
      PERFORM net.http_post(
        url := 'https://acgqjjbrnkmeazswdnzp.supabase.co/functions/v1/process-email-queue',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || worker_token),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      );
    END $dispatch$;
  $command$);
  -- Same transaction: the scheduler never sees this new job active on commit.
  PERFORM cron.alter_job(job_id, active := false);
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid=job_id AND active) THEN
    RAISE EXCEPTION 'Dispatcher must remain inactive';
  END IF;
END $install$;
COMMIT;
-- Operator off switch after future activation (preserves run history):
-- SELECT cron.alter_job(jobid, active := false) FROM cron.job WHERE jobname='schreiber-email-dispatch';
-- Also set EMAIL_DELIVERY_ENABLED=false; a request already in flight is not recalled.
