-- Unapplied release candidate. Review separately before promotion.
-- Preserve recipient eligibility and payload; suppress the second notification
-- when an active President is also an admin. CREATE OR REPLACE preserves ACL/owner.
CREATE OR REPLACE FUNCTION public.notify_safety_violation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_label text;
  v_link text;
  v_title text;
  v_body text;
  v_offender_user uuid;
  v_manager_user uuid;
  v_today date := current_date;
  r record;
BEGIN
  v_label := COALESCE(NULLIF(NEW.job_name_snapshot,''), 'a job');
  v_link := '/safety/violations/' || NEW.id::text;
  v_title := 'Safety violation filed';
  v_body := COALESCE(NEW.filed_by_name,'Someone') || ' issued a violation to ' || NEW.employee_name || ' on ' || v_label;

  -- Offender (the cited employee) + their manager via employee_contacts
  IF NEW.employee_contact_id IS NOT NULL THEN
    SELECT ec.converted_user_id, mgr.converted_user_id
      INTO v_offender_user, v_manager_user
    FROM public.employee_contacts ec
    LEFT JOIN public.employee_contacts mgr ON mgr.id = ec.manager_contact_id
    WHERE ec.id = NEW.employee_contact_id;
  END IF;

  IF v_offender_user IS NOT NULL THEN
    PERFORM public.notify_user(v_offender_user, 'safety_violation', v_title, v_body, v_link,
      jsonb_build_object('violation_id', NEW.id, 'discipline', NEW.disciplinary_action::text));
  END IF;

  IF v_manager_user IS NOT NULL AND v_manager_user IS DISTINCT FROM v_offender_user THEN
    PERFORM public.notify_user(v_manager_user, 'safety_violation', v_title, v_body, v_link,
      jsonb_build_object('violation_id', NEW.id, 'discipline', NEW.disciplinary_action::text));
  END IF;

  -- President(s): users currently holding the President position
  FOR r IN
    SELECT DISTINCT ep.user_id
    FROM public.employee_positions ep
    JOIN public.positions p ON p.id = ep.position_id
    WHERE p.title ILIKE 'President'
      AND ep.effective_date <= v_today
      AND (ep.end_date IS NULL OR ep.end_date >= v_today)
  LOOP
    IF r.user_id IS NOT NULL
       AND r.user_id IS DISTINCT FROM v_offender_user
       AND r.user_id IS DISTINCT FROM v_manager_user THEN
      PERFORM public.notify_user(r.user_id, 'safety_violation', v_title, v_body, v_link,
        jsonb_build_object('violation_id', NEW.id, 'discipline', NEW.disciplinary_action::text));
    END IF;
  END LOOP;

  -- Admins (skip duplicates)
  FOR r IN
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'::app_role
      -- Current Presidents were already notified by the preceding loop.
      AND NOT EXISTS (
        SELECT 1
        FROM public.employee_positions ep
        JOIN public.positions p ON p.id = ep.position_id
        WHERE ep.user_id = ur.user_id
          AND p.title ILIKE 'President'
          AND ep.effective_date <= v_today
          AND (ep.end_date IS NULL OR ep.end_date >= v_today)
      )
  LOOP
    IF r.user_id IS DISTINCT FROM v_offender_user
       AND r.user_id IS DISTINCT FROM v_manager_user THEN
      PERFORM public.notify_user(r.user_id, 'safety_violation', v_title, v_body, v_link,
        jsonb_build_object('violation_id', NEW.id, 'discipline', NEW.disciplinary_action::text));
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
