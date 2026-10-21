-- Unapplied release candidate. Review separately from data migration.
-- Break sessions -> attendees -> sessions RLS recursion without changing who qualifies.
-- Caller identity comes from auth.uid(), never a supplied user ID.
CREATE FUNCTION public.is_current_user_talk_attendee(_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.toolbox_talk_attendees AS a
    WHERE a.session_id = _session_id AND a.user_id = auth.uid()
  );
$$;
ALTER FUNCTION public.is_current_user_talk_attendee(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_current_user_talk_attendee(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_talk_attendee(uuid) TO authenticated;

ALTER POLICY "Attendees view their session" ON public.toolbox_talk_sessions
  USING (public.is_current_user_talk_attendee(id));
