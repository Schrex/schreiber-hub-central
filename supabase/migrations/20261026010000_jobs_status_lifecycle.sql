-- Jobs status lifecycle (#28). Promoted from local/candidate-migrations for release.
-- Release review must: count existing complete rows (no backfill; they keep a
-- null completed_at, shown as "Date unknown"), and confirm both
-- jobs_status_lifecycle and update_jobs_updated_at are enabled in production
-- (SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.jobs'::regclass).
ALTER TABLE public.jobs
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN hold_reason text;

-- The trigger normalizes ordinary writes; these reject contradictory rows from
-- any path that bypasses it.
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_completion_matches_status
    CHECK (status = 'complete' OR (completed_at IS NULL AND completed_by IS NULL)),
  ADD CONSTRAINT jobs_hold_reason_matches_status
    CHECK (status = 'on_hold' OR hold_reason IS NULL);

CREATE FUNCTION public.jobs_status_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'complete' THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'complete' THEN
      -- Entering complete: the closer is always the signed-in user (null for
      -- service role / Edge functions), never a client-supplied value.
      NEW.completed_by := auth.uid();
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSE
      -- Staying complete: the closer is pinned; the date may be corrected.
      NEW.completed_by := OLD.completed_by;
    END IF;
    IF (NEW.completed_at AT TIME ZONE 'America/New_York')::date
       > (now() AT TIME ZONE 'America/New_York')::date THEN
      RAISE EXCEPTION 'completed_at cannot be in the future (New York date)'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    NEW.completed_at := NULL;
    NEW.completed_by := NULL;
  END IF;
  IF NEW.status <> 'on_hold' THEN
    NEW.hold_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_status_lifecycle
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_status_lifecycle();
