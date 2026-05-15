-- Prevent regular users (including foremen/office) from reading
-- toolbox_talk_attendees.access_token via direct table SELECT.
-- Service role (used by edge functions) is unaffected.
REVOKE SELECT (access_token) ON public.toolbox_talk_attendees FROM authenticated;
REVOKE SELECT (access_token) ON public.toolbox_talk_attendees FROM anon;