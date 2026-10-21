-- Synthetic local-only, rollback-only proof of queue primitives used by restored RPCs.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgmq;
SELECT pgmq.create('migration_smoke_transactional');
SELECT pgmq.create('migration_smoke_dlq');
DO $$
DECLARE sent bigint; claimed record; moved bigint;
BEGIN
  SELECT pgmq.send('migration_smoke_transactional', '{"to":"recipient@example.test","message_id":"synthetic-queue-test"}'::jsonb) INTO sent;
  SELECT * INTO claimed FROM pgmq.read('migration_smoke_transactional', 30, 1);
  IF claimed.msg_id IS DISTINCT FROM sent OR claimed.message->>'message_id' <> 'synthetic-queue-test' THEN
    RAISE EXCEPTION 'Queue claim did not preserve payload';
  END IF;
  IF EXISTS (SELECT 1 FROM pgmq.read('migration_smoke_transactional', 30, 1)) THEN
    RAISE EXCEPTION 'Visibility timeout did not hide claimed message';
  END IF;
  SELECT pgmq.send('migration_smoke_dlq', claimed.message) INTO moved;
  PERFORM pgmq.delete('migration_smoke_transactional', sent);
  IF EXISTS (SELECT 1 FROM pgmq.q_migration_smoke_transactional) OR
    NOT EXISTS (SELECT 1 FROM pgmq.q_migration_smoke_dlq WHERE msg_id=moved) THEN
    RAISE EXCEPTION 'DLQ transfer failed';
  END IF;
END $$;
ROLLBACK;
SELECT to_regclass('pgmq.q_migration_smoke_transactional') IS NULL AS rollback_clean;
