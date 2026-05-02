
-- Extend toolbox_talk_attendees
ALTER TABLE public.toolbox_talk_attendees
  ADD COLUMN IF NOT EXISTS initial_quiz_score integer,
  ADD COLUMN IF NOT EXISTS initial_quiz_total integer,
  ADD COLUMN IF NOT EXISTS quiz_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS access_token text UNIQUE DEFAULT encode(gen_random_bytes(18),'hex'),
  ADD COLUMN IF NOT EXISTS notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_channel text,
  ADD COLUMN IF NOT EXISTS phone_snapshot text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'; -- 'schedule' or 'manual'

CREATE INDEX IF NOT EXISTS idx_attendee_token ON public.toolbox_talk_attendees(access_token);

-- Extend toolbox_talk_sessions
ALTER TABLE public.toolbox_talk_sessions
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'in_person',  -- 'in_person' | 'remote'
  ADD COLUMN IF NOT EXISTS topic_source text;  -- 'ai_schedule' | 'library' | 'manual'

-- Allow attendees to view the session/talk they're invited to
CREATE POLICY "Attendees view their session"
  ON public.toolbox_talk_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.toolbox_talk_attendees a
            WHERE a.session_id = toolbox_talk_sessions.id AND a.user_id = auth.uid())
  );

-- Attendees can view their own row
CREATE POLICY "Attendees view own row"
  ON public.toolbox_talk_attendees
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Notifications (generic, lightweight)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,            -- 'safety_talk_invite' etc
  title text NOT NULL,
  body text,
  link_url text,
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users mark own read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Service role inserts notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin')
  );

-- Phone column on employee_contacts already exists; ensure profiles has nothing extra needed.

-- Backfill access tokens for any existing attendees missing one
UPDATE public.toolbox_talk_attendees
SET access_token = encode(gen_random_bytes(18),'hex')
WHERE access_token IS NULL;
