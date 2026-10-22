-- Destination rehearsal only. Reviewed standalone installation, not a production migration.
-- Preserves all restored business/Auth/mail-log/suppression records.
-- Does not install pg_cron, pg_net, schedules, secrets, or historical queue messages.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgmq;
DO $$
BEGIN
  IF to_regclass('pgmq.q_transactional_emails') IS NOT NULL
    OR to_regclass('pgmq.q_transactional_emails_dlq') IS NOT NULL THEN
    RAISE EXCEPTION 'Queue already exists; inspect it instead of rerunning installer';
  END IF;
  PERFORM pgmq.create('transactional_emails');
  PERFORM pgmq.create('transactional_emails_dlq');
END $$;
-- Assert empty initial queues. No row contents are returned.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pgmq.q_transactional_emails)
    OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails_dlq) THEN
    RAISE EXCEPTION 'New queues are unexpectedly populated';
  END IF;
END $$;
COMMIT;
