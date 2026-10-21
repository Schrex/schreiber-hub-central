-- Run only on the explicitly authorized destination AFTER the grants candidate.
-- Requires an administrative SQL connection able to SET ROLE.
-- Fails closed on missing/overloaded wrappers, insecure settings or grants.
-- No business data, real queues, email logs or external endpoints are modified.
-- Temporary dedicated synthetic queues are created and fully rolled back.
-- Run with stop-on-error (psql -v ON_ERROR_STOP=1). Never replace ROLLBACK with COMMIT.
BEGIN;
SET LOCAL statement_timeout = '30s';
DO $$
DECLARE sig text; r text; t text; proc_record record;
BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN
      ('enqueue_email','read_email_batch','delete_email','move_to_dlq')) <> 4 THEN
    RAISE EXCEPTION 'Expected exactly four queue wrappers, no overloads';
  END IF;
  FOREACH sig IN ARRAY ARRAY['public.enqueue_email(text,jsonb)',
    'public.read_email_batch(text,integer,integer)','public.delete_email(text,bigint)',
    'public.move_to_dlq(text,text,bigint,jsonb)'] LOOP
    IF to_regprocedure(sig) IS NULL THEN RAISE EXCEPTION 'Missing wrapper %',sig; END IF;
    SELECT * INTO proc_record FROM pg_proc WHERE oid=to_regprocedure(sig);
    IF NOT proc_record.prosecdef OR NOT coalesce('search_path=public'=ANY(proc_record.proconfig),false) THEN
      RAISE EXCEPTION 'Unexpected security settings for %',sig;
    END IF;
    IF NOT has_function_privilege('service_role',proc_record.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'Missing service execute: %',sig;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_function_privilege(r,proc_record.oid,'EXECUTE') THEN
        RAISE EXCEPTION 'Browser role % can execute %',r,sig;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_schema_privilege(r,'public','CREATE') OR
       EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r AND (rolsuper OR rolbypassrls)) THEN
      RAISE EXCEPTION 'Browser role % has unsafe schema/RLS powers',r;
    END IF;
  END LOOP;
  IF NOT has_schema_privilege('service_role','public','USAGE') THEN
    RAISE EXCEPTION 'Service role lacks public schema usage';
  END IF;
  FOREACH t IN ARRAY ARRAY['email_send_log','email_send_state','email_unsubscribe_tokens','suppressed_emails'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||t) AND relrowsecurity) THEN
      RAISE EXCEPTION 'Missing email table or RLS: %',t;
    END IF;
    IF NOT has_table_privilege('service_role','public.'||t,'SELECT') OR
       (t <> 'email_send_state' AND NOT has_table_privilege('service_role','public.'||t,'INSERT')) THEN
      RAISE EXCEPTION 'Missing service table SELECT/INSERT: %',t;
    END IF;
    IF t IN ('email_send_state','email_unsubscribe_tokens') AND NOT has_table_privilege('service_role','public.'||t,'UPDATE') THEN
      RAISE EXCEPTION 'Missing service table UPDATE: %',t;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(r,'public.'||t,'TRUNCATE') THEN
        RAISE EXCEPTION 'Browser role % can truncate % (not protected by RLS)',r,t;
      END IF;
    END LOOP;
  END LOOP;
  IF to_regclass('pgmq.q_permission_probe') IS NOT NULL OR
     to_regclass('pgmq.q_permission_probe_dlq') IS NOT NULL THEN
    RAISE EXCEPTION 'Synthetic probe names already exist; stop and inspect';
  END IF;
END $$;

-- Dynamic role switches are scoped to this transaction. A denial must be
-- SQLSTATE 42501, not a missing queue/function error masquerading as a pass.
DO $$
DECLARE r text; call_sql text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I',r);
    FOREACH call_sql IN ARRAY ARRAY[
      $q$SELECT public.enqueue_email('permission_probe','{}'::jsonb)$q$,
      $q$SELECT * FROM public.read_email_batch('permission_probe',1,30)$q$,
      $q$SELECT public.delete_email('permission_probe',-1)$q$,
      $q$SELECT public.move_to_dlq('permission_probe','permission_probe_dlq',-1,'{}'::jsonb)$q$
    ] LOOP
      BEGIN
        EXECUTE call_sql;
        RAISE EXCEPTION 'Expected browser permission denial for role %',r;
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
    END LOOP;
    RESET ROLE;
  END LOOP;
END $$;

SET LOCAL ROLE service_role;
DO $$
DECLARE sent bigint; moved bigint; claimed record;
BEGIN
  sent := public.enqueue_email('permission_probe',
    '{"to":"queue-probe@example.invalid","message_id":"permission-probe-only"}'::jsonb);
  SELECT * INTO claimed FROM public.read_email_batch('permission_probe',1,30);
  IF claimed.msg_id IS DISTINCT FROM sent OR
     claimed.message->>'message_id' IS DISTINCT FROM 'permission-probe-only' THEN
    RAISE EXCEPTION 'Service wrapper enqueue/read failed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.read_email_batch('permission_probe',1,30)) THEN
    RAISE EXCEPTION 'Visibility timeout failed';
  END IF;
  moved := public.move_to_dlq('permission_probe','permission_probe_dlq',sent,claimed.message);
  SELECT * INTO claimed FROM public.read_email_batch('permission_probe_dlq',1,30);
  IF claimed.msg_id IS DISTINCT FROM moved OR
     claimed.message->>'message_id' IS DISTINCT FROM 'permission-probe-only' THEN
    RAISE EXCEPTION 'Service wrapper DLQ transfer failed';
  END IF;
  IF NOT public.delete_email('permission_probe_dlq',moved) OR
     public.delete_email('permission_probe',sent) THEN
    RAISE EXCEPTION 'Service wrapper delete/source removal failed';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT to_regclass('pgmq.q_permission_probe') IS NULL
   AND to_regclass('pgmq.q_permission_probe_dlq') IS NULL AS probe_rollback_clean;
