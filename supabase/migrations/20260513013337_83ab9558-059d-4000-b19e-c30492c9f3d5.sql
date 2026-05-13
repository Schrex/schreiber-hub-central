-- Enable RLS on realtime.messages (controls Broadcast/Presence channel auth).
-- The app does not use Broadcast or Presence — only postgres_changes, which
-- continues to enforce per-table RLS independently. Deny all access here.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='realtime' AND tablename='messages'
  LOOP
    EXECUTE format('DROP POLICY %I ON realtime.messages', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Deny broadcast/presence by default"
ON realtime.messages
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);