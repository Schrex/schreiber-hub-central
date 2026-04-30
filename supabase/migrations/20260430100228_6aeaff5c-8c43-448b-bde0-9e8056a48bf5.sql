
-- App settings (key/value, admin-managed)
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage settings" ON public.app_settings
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

INSERT INTO public.app_settings (key, value) VALUES
  ('york_safety_email', '"info@yorksafetysolutions.com"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Safety inspection requests
CREATE TABLE public.safety_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  requested_by uuid,
  requested_by_name text,
  recipient_email text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.safety_inspections(job_id);
ALTER TABLE public.safety_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can view inspections" ON public.safety_inspections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert inspections" ON public.safety_inspections
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete inspections" ON public.safety_inspections
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- Safety rules (company-wide)
CREATE TABLE public.safety_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.safety_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can view active rules" ON public.safety_rules
  FOR SELECT TO authenticated USING (is_active = true OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage rules" ON public.safety_rules
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_safety_rules_updated BEFORE UPDATE ON public.safety_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Toolbox talks library
CREATE TABLE public.toolbox_talks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  content text NOT NULL,
  -- quiz_questions: [{ question, options:[..], correct_index }]
  quiz_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_with_ai boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.toolbox_talks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can view active talks" ON public.toolbox_talks
  FOR SELECT TO authenticated USING (is_active = true OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage talks" ON public.toolbox_talks
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_toolbox_talks_updated BEFORE UPDATE ON public.toolbox_talks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Toolbox talk sessions (a foreman delivering a talk)
CREATE TABLE public.toolbox_talk_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talk_id uuid NOT NULL REFERENCES public.toolbox_talks(id) ON DELETE RESTRICT,
  foreman_id uuid NOT NULL,
  foreman_name text,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'in_progress', -- in_progress, completed
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  recording_started_at timestamptz,
  recording_stopped_at timestamptz,
  audio_path text,
  transcript text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.toolbox_talk_sessions(foreman_id);
CREATE INDEX ON public.toolbox_talk_sessions(talk_id);
ALTER TABLE public.toolbox_talk_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Foreman+ view sessions" ON public.toolbox_talk_sessions
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin')
    OR foreman_id = auth.uid()
  );
CREATE POLICY "Foreman+ create sessions" ON public.toolbox_talk_sessions
  FOR INSERT TO authenticated WITH CHECK (
    (has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'admin')) AND foreman_id = auth.uid()
  );
CREATE POLICY "Foreman update own sessions" ON public.toolbox_talk_sessions
  FOR UPDATE TO authenticated USING (
    foreman_id = auth.uid() OR has_role(auth.uid(),'admin')
  );
CREATE POLICY "Admins delete sessions" ON public.toolbox_talk_sessions
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_talk_sessions_updated BEFORE UPDATE ON public.toolbox_talk_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attendees (one row per participant per session)
CREATE TABLE public.toolbox_talk_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.toolbox_talk_sessions(id) ON DELETE CASCADE,
  user_id uuid,
  attendee_name text NOT NULL,
  signature_data text, -- base64 PNG of signature
  signed_at timestamptz,
  quiz_answers jsonb, -- [{question_index, selected_index}]
  quiz_score integer,
  quiz_total integer,
  quiz_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.toolbox_talk_attendees(session_id);
CREATE INDEX ON public.toolbox_talk_attendees(user_id);
ALTER TABLE public.toolbox_talk_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View attendees you participated in" ON public.toolbox_talk_attendees
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin')
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.toolbox_talk_sessions s WHERE s.id = session_id AND s.foreman_id = auth.uid())
  );
CREATE POLICY "Foreman add attendees" ON public.toolbox_talk_attendees
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.toolbox_talk_sessions s WHERE s.id = session_id
      AND (s.foreman_id = auth.uid() OR has_role(auth.uid(),'admin')))
  );
CREATE POLICY "Sign own attendance or foreman edit" ON public.toolbox_talk_attendees
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.toolbox_talk_sessions s WHERE s.id = session_id AND s.foreman_id = auth.uid())
    OR has_role(auth.uid(),'admin')
  );
CREATE POLICY "Foreman delete attendees" ON public.toolbox_talk_attendees
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.toolbox_talk_sessions s WHERE s.id = session_id AND s.foreman_id = auth.uid())
    OR has_role(auth.uid(),'admin')
  );

-- Storage bucket for talk audio
INSERT INTO storage.buckets (id, name, public) VALUES ('talk-audio','talk-audio', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Foreman+ read talk audio" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'talk-audio' AND (
      has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'office') OR has_role(auth.uid(),'admin')
    )
  );
CREATE POLICY "Foreman+ upload talk audio" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'talk-audio' AND (
      has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'admin')
    )
  );
CREATE POLICY "Foreman+ delete talk audio" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'talk-audio' AND (
      has_role(auth.uid(),'foreman') OR has_role(auth.uid(),'admin')
    )
  );
