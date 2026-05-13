
-- ============================================================
-- 1) employee_contacts: split sensitive vs directory access
-- ============================================================
DROP POLICY IF EXISTS "Anyone signed in can view employee contacts" ON public.employee_contacts;
DROP POLICY IF EXISTS "Foreman office admin insert employee contacts" ON public.employee_contacts;
DROP POLICY IF EXISTS "Foreman office admin update employee contacts" ON public.employee_contacts;
DROP POLICY IF EXISTS "Office admin view employee contacts" ON public.employee_contacts;
DROP POLICY IF EXISTS "Office admin insert employee contacts" ON public.employee_contacts;
DROP POLICY IF EXISTS "Office admin update employee contacts" ON public.employee_contacts;
DROP POLICY IF EXISTS "Users view own contact row" ON public.employee_contacts;
DROP POLICY IF EXISTS "Directory read (non-sensitive) on employee_contacts" ON public.employee_contacts;

-- RLS: any authenticated user may read active contacts (column-level grant restricts which columns)
CREATE POLICY "Authenticated read active employee contacts"
ON public.employee_contacts FOR SELECT TO authenticated
USING (
  is_active = true
  OR converted_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'office'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Office admin insert employee contacts"
ON public.employee_contacts FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'office'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin update employee contacts"
ON public.employee_contacts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'office'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Column-level: signed-in users only see directory columns. Sensitive columns
-- (ssn, bank_*, drivers_license_number, address, personal_email,
-- emergency_contact_*, termination_reason, terminated_by) are NOT granted to
-- authenticated. Office/admin reach those via the existing
-- get_employee_contact_sensitive(_id) RPC.
REVOKE SELECT ON public.employee_contacts FROM authenticated;
GRANT SELECT (
  id, name, first_name, last_name, middle_initial,
  job_title, department, phone, email, work_email,
  is_active, created_by, created_at, updated_at,
  converted_user_id, date_of_birth,
  drivers_license_class, drivers_license_expires,
  osha_card_number, osha_expires, other_certifications,
  hire_date, termination_date, manager_contact_id, notes
) ON public.employee_contacts TO authenticated;

-- service_role keeps full access (default), so triggers/edge functions are unaffected.

-- ============================================================
-- 2) dispatch_orders: restrict SELECT to office/admin
-- ============================================================
DROP POLICY IF EXISTS "Anyone signed in can view dispatch orders" ON public.dispatch_orders;
CREATE POLICY "Office admin view dispatch orders"
ON public.dispatch_orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'office'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 3) safety_inspections: restrict SELECT to office/admin
-- ============================================================
DROP POLICY IF EXISTS "Office/admin or requester can view safety inspections" ON public.safety_inspections;
CREATE POLICY "Office admin view safety inspections"
ON public.safety_inspections FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'office'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4) toolbox_talk_attendees: hide access_token from broad reads
-- ============================================================
REVOKE SELECT ON public.toolbox_talk_attendees FROM authenticated;
GRANT SELECT (
  id, session_id, user_id, attendee_name,
  signature_data, signed_at, quiz_answers, quiz_score, quiz_total,
  quiz_completed_at, created_at, initial_quiz_score, initial_quiz_total,
  quiz_attempts, notified_at, notify_channel, phone_snapshot, source
) ON public.toolbox_talk_attendees TO authenticated;

-- RPC for the link-based "take talk" flow
CREATE OR REPLACE FUNCTION public.get_attendee_by_token(_token text)
RETURNS TABLE(
  id uuid, session_id uuid, user_id uuid, attendee_name text,
  signature_data text, signed_at timestamptz,
  quiz_answers jsonb, quiz_score int, quiz_total int,
  quiz_completed_at timestamptz, created_at timestamptz,
  initial_quiz_score int, initial_quiz_total int,
  quiz_attempts int, notified_at timestamptz,
  notify_channel text, phone_snapshot text, source text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.session_id, a.user_id, a.attendee_name,
         a.signature_data, a.signed_at, a.quiz_answers, a.quiz_score, a.quiz_total,
         a.quiz_completed_at, a.created_at, a.initial_quiz_score, a.initial_quiz_total,
         a.quiz_attempts, a.notified_at, a.notify_channel::text, a.phone_snapshot, a.source::text
  FROM public.toolbox_talk_attendees a
  WHERE a.access_token = _token
    AND (a.user_id IS NULL OR a.user_id = auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_attendee_by_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendee_by_token(text) TO authenticated;

-- ============================================================
-- 5) Lock down EXECUTE on internal SECURITY DEFINER functions.
--    Keep has_role / get_primary_role callable (used inside RLS).
--    Keep get_attendee_by_token / get_employee_contact_sensitive callable.
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname NOT IN (
        'has_role', 'get_primary_role',
        'get_attendee_by_token', 'get_employee_contact_sensitive'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      r.nspname, r.proname, r.args
    );
  END LOOP;
END $$;
