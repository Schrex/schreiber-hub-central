-- Schedule assignments: office/admin assign employees to jobs by date
CREATE TABLE public.schedule_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  assignment_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE,
  role_on_job TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id, assignment_date)
);

CREATE INDEX idx_sched_date ON public.schedule_assignments(assignment_date);
CREATE INDEX idx_sched_user_date ON public.schedule_assignments(user_id, assignment_date);
CREATE INDEX idx_sched_job_date ON public.schedule_assignments(job_id, assignment_date);

ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view assignments"
  ON public.schedule_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Office admin insert assignments"
  ON public.schedule_assignments FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin update assignments"
  ON public.schedule_assignments FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin delete assignments"
  ON public.schedule_assignments FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_schedule_assignments_updated_at
  BEFORE UPDATE ON public.schedule_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();