-- UNAPPLIED release candidate. Local replay only via scripts/prepare-local.mjs.
-- Do not copy into supabase/migrations without a separate reviewed release.
-- Task look-ahead grid (CL-1). No cost, rate, price, or billing columns.

ALTER TABLE public.jobs
  ADD COLUMN lookahead_grid_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.jobs.lookahead_grid_enabled IS
  'When true, the job page shows the task look-ahead grid. Default off.';

CREATE TABLE public.lookahead_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  weeks integer NOT NULL DEFAULT 3,
  status text NOT NULL,
  source text NOT NULL,
  source_filename text,
  source_checksum text,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  replaces_plan_id uuid REFERENCES public.lookahead_plans(id) ON DELETE SET NULL,
  CONSTRAINT lookahead_plans_week_start_monday CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  CONSTRAINT lookahead_plans_weeks_positive CHECK (weeks BETWEEN 1 AND 8),
  CONSTRAINT lookahead_plans_status_check CHECK (status IN ('draft', 'published', 'superseded')),
  CONSTRAINT lookahead_plans_source_check CHECK (source IN ('manual', 'mspdi_xml', 'pdf_ai', 'seed'))
);

CREATE UNIQUE INDEX lookahead_plans_one_published_per_job
  ON public.lookahead_plans (job_id)
  WHERE status = 'published';

CREATE INDEX lookahead_plans_job_status_idx ON public.lookahead_plans (job_id, status);

CREATE TRIGGER update_lookahead_plans_updated_at
  BEFORE UPDATE ON public.lookahead_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.lookahead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.lookahead_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  group_name text,
  contractor_type text NOT NULL,
  contractor_name text NOT NULL DEFAULT '',
  note text,
  sort_order integer NOT NULL,
  mpp_unique_id bigint,
  mpp_wbs text,
  outline_number text,
  pct_complete numeric,
  is_placeholder_skipped boolean NOT NULL DEFAULT false,
  carried_from_task_id uuid REFERENCES public.lookahead_tasks(id) ON DELETE SET NULL,
  CONSTRAINT lookahead_tasks_contractor_type_check CHECK (
    contractor_type IN ('schreiber', 'sub', 'others', 'crew')
  )
);

CREATE INDEX lookahead_tasks_plan_sort_idx ON public.lookahead_tasks (plan_id, sort_order);

CREATE TABLE public.lookahead_task_days (
  task_id uuid NOT NULL REFERENCES public.lookahead_tasks(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  PRIMARY KEY (task_id, work_date),
  CONSTRAINT lookahead_task_days_weekday CHECK (EXTRACT(ISODOW FROM work_date) BETWEEN 1 AND 5)
);

CREATE TABLE public.lookahead_plan_holidays (
  plan_id uuid NOT NULL REFERENCES public.lookahead_plans(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  label text NOT NULL,
  PRIMARY KEY (plan_id, holiday_date)
);

CREATE TABLE public.lookahead_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.lookahead_plans(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.lookahead_tasks(id) ON DELETE SET NULL,
  work_date date,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lookahead_acks_kind_check CHECK (kind IN ('problem', 'got_it')),
  CONSTRAINT lookahead_acks_problem_comment CHECK (
    kind <> 'problem'
    OR (comment IS NOT NULL AND char_length(btrim(comment)) BETWEEN 3 AND 2000)
  )
);

CREATE INDEX lookahead_acks_plan_idx ON public.lookahead_acks (plan_id, created_at);

CREATE TABLE public.lookahead_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.lookahead_plans(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.lookahead_tasks(id) ON DELETE SET NULL,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  bulk_op_id uuid
);

CREATE INDEX lookahead_changes_plan_idx ON public.lookahead_changes (plan_id, changed_at);

CREATE TABLE public.lookahead_views (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.lookahead_plans(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, plan_id)
);

CREATE TABLE public.lookahead_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.lookahead_plans(id) ON DELETE SET NULL,
  kind text NOT NULL,
  status text NOT NULL,
  input_filename text,
  input_checksum text,
  parser_version text,
  summary jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision text,
  CONSTRAINT lookahead_import_runs_kind_check CHECK (kind IN ('mspdi_xml', 'pdf_ai')),
  CONSTRAINT lookahead_import_runs_status_check CHECK (
    status IN ('parsed', 'failed', 'applied_draft', 'rejected')
  ),
  CONSTRAINT lookahead_import_runs_decision_check CHECK (
    decision IS NULL OR decision IN ('approved_publish', 'discarded')
  )
);

COMMENT ON COLUMN public.lookahead_import_runs.summary IS
  'Task counts, skipped placeholders, and holiday dates. Do not store cost or rate figures.';

CREATE INDEX lookahead_import_runs_job_idx ON public.lookahead_import_runs (job_id, created_at);

-- Published and superseded plans are readable by any signed-in user.
-- Drafts are office/admin only.
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
          p.status IN ('published', 'superseded')
          OR public.has_role(auth.uid(), 'office')
          OR public.has_role(auth.uid(), 'admin')
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.lookahead_can_write()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'office')
      OR public.has_role(auth.uid(), 'admin')
    );
$$;

-- Problem reports are allowlisted. Missing or empty setting denies everyone.
-- Value shape: a JSON array of user-id strings in app_settings.
CREATE OR REPLACE FUNCTION public.lookahead_can_file_problem()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.app_settings s
      WHERE s.key = 'lookahead_problem_allowlist_user_ids'
        AND jsonb_typeof(s.value) = 'array'
        AND s.value ? auth.uid()::text
    );
$$;

CREATE OR REPLACE FUNCTION public.lookahead_reject_holiday_day()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.lookahead_tasks t
    JOIN public.lookahead_plan_holidays h ON h.plan_id = t.plan_id
    WHERE t.id = NEW.task_id
      AND h.holiday_date = NEW.work_date
  ) THEN
    RAISE EXCEPTION 'lookahead task days cannot fall on a plan holiday'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lookahead_task_days_reject_holiday
  BEFORE INSERT OR UPDATE ON public.lookahead_task_days
  FOR EACH ROW EXECUTE FUNCTION public.lookahead_reject_holiday_day();

CREATE OR REPLACE FUNCTION public.lookahead_reject_holiday_with_marks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.lookahead_tasks t
    JOIN public.lookahead_task_days d ON d.task_id = t.id
    WHERE t.plan_id = NEW.plan_id
      AND d.work_date = NEW.holiday_date
  ) THEN
    RAISE EXCEPTION 'plan holiday conflicts with an existing task day'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lookahead_plan_holidays_reject_marks
  BEFORE INSERT OR UPDATE ON public.lookahead_plan_holidays
  FOR EACH ROW EXECUTE FUNCTION public.lookahead_reject_holiday_with_marks();

-- Append-only change log. Deletes are logged before the row disappears so the
-- task id still satisfies the foreign key; plan deletes cascade the log away.
CREATE OR REPLACE FUNCTION public.lookahead_log_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan uuid;
  v_task uuid;
BEGIN
  IF TG_TABLE_NAME = 'lookahead_plans' THEN
    v_plan := COALESCE(NEW.id, OLD.id);
    v_task := NULL;
  ELSIF TG_TABLE_NAME = 'lookahead_tasks' THEN
    v_plan := COALESCE(NEW.plan_id, OLD.plan_id);
    v_task := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSIF TG_TABLE_NAME = 'lookahead_task_days' THEN
    v_task := CASE WHEN TG_OP = 'DELETE' THEN OLD.task_id ELSE NEW.task_id END;
    SELECT t.plan_id INTO v_plan FROM public.lookahead_tasks t WHERE t.id = v_task;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_plan IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.lookahead_changes (plan_id, task_id, action, old_value, new_value, changed_by)
  VALUES (
    v_plan,
    v_task,
    lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER lookahead_plans_log_write
  AFTER INSERT OR UPDATE ON public.lookahead_plans
  FOR EACH ROW EXECUTE FUNCTION public.lookahead_log_change();

CREATE TRIGGER lookahead_plans_log_delete
  BEFORE DELETE ON public.lookahead_plans
  FOR EACH ROW EXECUTE FUNCTION public.lookahead_log_change();

CREATE TRIGGER lookahead_tasks_log_write
  AFTER INSERT OR UPDATE ON public.lookahead_tasks
  FOR EACH ROW EXECUTE FUNCTION public.lookahead_log_change();

CREATE TRIGGER lookahead_tasks_log_delete
  BEFORE DELETE ON public.lookahead_tasks
  FOR EACH ROW EXECUTE FUNCTION public.lookahead_log_change();

CREATE TRIGGER lookahead_task_days_log_write
  AFTER INSERT OR UPDATE ON public.lookahead_task_days
  FOR EACH ROW EXECUTE FUNCTION public.lookahead_log_change();

CREATE TRIGGER lookahead_task_days_log_delete
  BEFORE DELETE ON public.lookahead_task_days
  FOR EACH ROW EXECUTE FUNCTION public.lookahead_log_change();

ALTER TABLE public.lookahead_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookahead_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookahead_task_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookahead_plan_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookahead_acks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookahead_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookahead_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookahead_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read visible lookahead plans"
  ON public.lookahead_plans FOR SELECT TO authenticated
  USING (public.lookahead_plan_readable(id));

CREATE POLICY "Office and admin insert lookahead plans"
  ON public.lookahead_plans FOR INSERT TO authenticated
  WITH CHECK (public.lookahead_can_write());

CREATE POLICY "Office and admin update lookahead plans"
  ON public.lookahead_plans FOR UPDATE TO authenticated
  USING (public.lookahead_can_write())
  WITH CHECK (public.lookahead_can_write());

CREATE POLICY "Office and admin delete lookahead plans"
  ON public.lookahead_plans FOR DELETE TO authenticated
  USING (public.lookahead_can_write());

CREATE POLICY "Signed-in users read visible lookahead tasks"
  ON public.lookahead_tasks FOR SELECT TO authenticated
  USING (public.lookahead_plan_readable(plan_id));

CREATE POLICY "Office and admin insert lookahead tasks"
  ON public.lookahead_tasks FOR INSERT TO authenticated
  WITH CHECK (public.lookahead_can_write());

CREATE POLICY "Office and admin update lookahead tasks"
  ON public.lookahead_tasks FOR UPDATE TO authenticated
  USING (public.lookahead_can_write())
  WITH CHECK (public.lookahead_can_write());

CREATE POLICY "Office and admin delete lookahead tasks"
  ON public.lookahead_tasks FOR DELETE TO authenticated
  USING (public.lookahead_can_write());

CREATE POLICY "Signed-in users read visible lookahead days"
  ON public.lookahead_task_days FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lookahead_tasks t
      WHERE t.id = task_id AND public.lookahead_plan_readable(t.plan_id)
    )
  );

CREATE POLICY "Office and admin insert lookahead days"
  ON public.lookahead_task_days FOR INSERT TO authenticated
  WITH CHECK (public.lookahead_can_write());

CREATE POLICY "Office and admin update lookahead days"
  ON public.lookahead_task_days FOR UPDATE TO authenticated
  USING (public.lookahead_can_write())
  WITH CHECK (public.lookahead_can_write());

CREATE POLICY "Office and admin delete lookahead days"
  ON public.lookahead_task_days FOR DELETE TO authenticated
  USING (public.lookahead_can_write());

CREATE POLICY "Signed-in users read visible lookahead holidays"
  ON public.lookahead_plan_holidays FOR SELECT TO authenticated
  USING (public.lookahead_plan_readable(plan_id));

CREATE POLICY "Office and admin insert lookahead holidays"
  ON public.lookahead_plan_holidays FOR INSERT TO authenticated
  WITH CHECK (public.lookahead_can_write());

CREATE POLICY "Office and admin update lookahead holidays"
  ON public.lookahead_plan_holidays FOR UPDATE TO authenticated
  USING (public.lookahead_can_write())
  WITH CHECK (public.lookahead_can_write());

CREATE POLICY "Office and admin delete lookahead holidays"
  ON public.lookahead_plan_holidays FOR DELETE TO authenticated
  USING (public.lookahead_can_write());

CREATE POLICY "Signed-in users read visible lookahead acks"
  ON public.lookahead_acks FOR SELECT TO authenticated
  USING (public.lookahead_plan_readable(plan_id));

CREATE POLICY "Allowlisted users insert lookahead problems"
  ON public.lookahead_acks FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND kind = 'problem'
    AND public.lookahead_can_file_problem()
    AND public.lookahead_plan_readable(plan_id)
    AND comment IS NOT NULL
    AND char_length(btrim(comment)) BETWEEN 3 AND 2000
  );

CREATE POLICY "Signed-in users read visible lookahead changes"
  ON public.lookahead_changes FOR SELECT TO authenticated
  USING (public.lookahead_plan_readable(plan_id));

CREATE POLICY "Signed-in users read visible lookahead views"
  ON public.lookahead_views FOR SELECT TO authenticated
  USING (public.lookahead_plan_readable(plan_id));

CREATE POLICY "Office and admin insert own lookahead views"
  ON public.lookahead_views FOR INSERT TO authenticated
  WITH CHECK (public.lookahead_can_write() AND user_id = auth.uid());

CREATE POLICY "Office and admin update own lookahead views"
  ON public.lookahead_views FOR UPDATE TO authenticated
  USING (public.lookahead_can_write() AND user_id = auth.uid())
  WITH CHECK (public.lookahead_can_write() AND user_id = auth.uid());

CREATE POLICY "Office and admin read lookahead import runs"
  ON public.lookahead_import_runs FOR SELECT TO authenticated
  USING (public.lookahead_can_write());

REVOKE ALL ON FUNCTION public.lookahead_plan_readable(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lookahead_can_write() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lookahead_can_file_problem() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lookahead_reject_holiday_day() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lookahead_reject_holiday_with_marks() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lookahead_log_change() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.lookahead_plan_readable(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookahead_can_write() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookahead_can_file_problem() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookahead_reject_holiday_day() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookahead_log_change() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookahead_reject_holiday_with_marks() TO authenticated, service_role;

REVOKE ALL ON TABLE
  public.lookahead_plans,
  public.lookahead_tasks,
  public.lookahead_task_days,
  public.lookahead_plan_holidays,
  public.lookahead_acks,
  public.lookahead_changes,
  public.lookahead_views,
  public.lookahead_import_runs
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.lookahead_plans,
  public.lookahead_tasks,
  public.lookahead_task_days,
  public.lookahead_plan_holidays,
  public.lookahead_acks,
  public.lookahead_views
TO authenticated;

GRANT SELECT ON TABLE public.lookahead_changes TO authenticated;
GRANT SELECT ON TABLE public.lookahead_import_runs TO authenticated;

GRANT ALL ON TABLE
  public.lookahead_plans,
  public.lookahead_tasks,
  public.lookahead_task_days,
  public.lookahead_plan_holidays,
  public.lookahead_acks,
  public.lookahead_changes,
  public.lookahead_views,
  public.lookahead_import_runs
TO service_role;
