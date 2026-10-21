-- Explicit destination-only repair for restored schema ACLs.
-- Complements 20261020211000_rehearsal_queue_service_grants.sql.
-- No browser grants, row changes, scheduler or delivery activation.
BEGIN;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT ON public.email_send_log TO service_role;
GRANT SELECT, UPDATE ON public.email_send_state TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.email_unsubscribe_tokens TO service_role;
GRANT SELECT, INSERT ON public.suppressed_emails TO service_role;
-- send-transactional-email checks caller roles with its server-side client.
GRANT SELECT ON public.user_roles TO service_role;
-- These IDs are UUID defaults (send_state uses constant 1), not sequences.
-- Stop for unexpected identity/serial drift rather than granting all sequences.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class s JOIN pg_depend d ON d.objid=s.oid
    WHERE s.relkind='S' AND d.refobjid IN
      ('public.email_send_log'::regclass,'public.email_send_state'::regclass,
       'public.email_unsubscribe_tokens'::regclass,'public.suppressed_emails'::regclass)
  ) THEN RAISE EXCEPTION 'Unexpected email sequence dependency; review before applying'; END IF;
END $$;
COMMIT;
