-- UNAPPLIED release candidate. Local replay only via scripts/prepare-local.mjs.
-- Publish an uploaded look-ahead in one transaction. No cost or rate columns.

-- Version history (draft and superseded) stays with office/admin.
-- The live published plan stays readable by anyone signed in.
CREATE OR REPLACE FUNCTION public.lookahead_plan_readable(target_plan uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.lookahead_plans p
      WHERE p.id = target_plan
        AND (
          p.status = 'published'
          OR public.has_role(auth.uid(), 'office')
          OR public.has_role(auth.uid(), 'admin')
        )
    );
$$;

ALTER TABLE public.lookahead_import_runs
  DROP CONSTRAINT lookahead_import_runs_status_check;

ALTER TABLE public.lookahead_import_runs
  ADD CONSTRAINT lookahead_import_runs_status_check
  CHECK (status IN ('parsed', 'failed', 'applied_draft', 'rejected', 'published'));

CREATE OR REPLACE FUNCTION public.publish_lookahead_upload(p_job_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan uuid;
  v_task uuid;
  v_item jsonb;
  v_day text;
  v_holiday jsonb;
  v_week date;
  v_weeks integer;
  v_filename text;
  v_summary jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Upload payload is missing';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM regexp_matches(p_payload::text, '"([A-Za-z0-9_]+)"\s*:', 'g') AS found(parts)
    WHERE lower(parts[1]) ~ '(cost|rate|price|billing|dollar)'
  ) THEN
    RAISE EXCEPTION 'Cost fields are not accepted' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = p_job_id) THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  v_week := (p_payload->>'week_start')::date;
  v_weeks := COALESCE((p_payload->>'weeks')::integer, 4);
  IF v_week IS NULL OR EXTRACT(ISODOW FROM v_week) <> 1 THEN
    RAISE EXCEPTION 'week_start must be a Monday';
  END IF;
  IF v_weeks < 1 OR v_weeks > 8 THEN
    RAISE EXCEPTION 'weeks must be between 1 and 8';
  END IF;
  v_filename := left(COALESCE(p_payload->>'source_filename', ''), 240);

  UPDATE public.lookahead_plans
  SET status = 'superseded', updated_by = auth.uid()
  WHERE job_id = p_job_id AND status = 'published';

  INSERT INTO public.lookahead_plans (
    job_id, week_start, weeks, status, source, source_filename,
    published_at, published_by, created_by, updated_by
  ) VALUES (
    p_job_id, v_week, v_weeks, 'published', 'mspdi_xml', NULLIF(v_filename, ''),
    now(), auth.uid(), auth.uid(), auth.uid()
  ) RETURNING id INTO v_plan;

  FOR v_holiday IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'holidays', '[]'::jsonb))
  LOOP
    INSERT INTO public.lookahead_plan_holidays (plan_id, holiday_date, label)
    VALUES (v_plan, (v_holiday->>'date')::date, left(COALESCE(v_holiday->>'label', 'Holiday'), 80));
  END LOOP;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'tasks', '[]'::jsonb))
  LOOP
    IF NULLIF(btrim(v_item->>'name'), '') IS NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO public.lookahead_tasks (
      plan_id, name, group_name, contractor_type, contractor_name, sort_order,
      mpp_unique_id, mpp_wbs, outline_number, pct_complete
    ) VALUES (
      v_plan,
      v_item->>'name',
      NULLIF(v_item->>'group_name', ''),
      v_item->>'contractor_type',
      COALESCE(v_item->>'contractor_name', ''),
      COALESCE((v_item->>'sort_order')::integer, 0),
      NULLIF(v_item->>'mpp_unique_id', '')::bigint,
      NULLIF(v_item->>'mpp_wbs', ''),
      NULLIF(v_item->>'outline_number', ''),
      NULLIF(v_item->>'pct_complete', '')::numeric
    ) RETURNING id INTO v_task;

    FOR v_day IN
      SELECT jsonb_array_elements_text(COALESCE(v_item->'days', '[]'::jsonb))
    LOOP
      INSERT INTO public.lookahead_task_days (task_id, work_date)
      VALUES (v_task, v_day::date);
    END LOOP;
  END LOOP;

  UPDATE public.jobs
  SET lookahead_grid_enabled = true
  WHERE id = p_job_id;

  v_summary := jsonb_build_object(
    'task_count', COALESCE(jsonb_array_length(p_payload->'tasks'), 0),
    'holiday_dates', COALESCE(
      (SELECT jsonb_agg(value->>'date') FROM jsonb_array_elements(COALESCE(p_payload->'holidays', '[]'::jsonb))),
      '[]'::jsonb
    ),
    'skipped_placeholder_count', COALESCE((p_payload->>'skipped_placeholder_count')::integer, 0)
  );
  INSERT INTO public.lookahead_import_runs (
    job_id, plan_id, kind, status, input_filename, summary, created_by, reviewed_by, reviewed_at, decision
  ) VALUES (
    p_job_id, v_plan, 'mspdi_xml', 'published', NULLIF(v_filename, ''), v_summary,
    auth.uid(), auth.uid(), now(), 'approved_publish'
  );

  RETURN v_plan;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_lookahead_upload(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_lookahead_upload(uuid, jsonb) TO authenticated, service_role;
