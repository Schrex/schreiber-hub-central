-- swpppp_reports table
CREATE TABLE public.swpppp_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  week_of DATE NOT NULL,
  report_date DATE,
  title TEXT,
  email_subject TEXT,
  email_from TEXT,
  email_received_at TIMESTAMPTZ,
  notes TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  source TEXT NOT NULL DEFAULT 'upload', -- 'upload' or 'email'
  uploaded_by UUID,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_swpppp_reports_job ON public.swpppp_reports(job_id, week_of DESC);

ALTER TABLE public.swpppp_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view swpppp reports"
  ON public.swpppp_reports FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Office admin insert swpppp reports"
  ON public.swpppp_reports FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin update swpppp reports"
  ON public.swpppp_reports FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin delete swpppp reports"
  ON public.swpppp_reports FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_swpppp_reports_updated_at
  BEFORE UPDATE ON public.swpppp_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('swpppp-reports', 'swpppp-reports', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Signed-in can read swpppp files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'swpppp-reports');

CREATE POLICY "Office admin insert swpppp files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'swpppp-reports' AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Office admin update swpppp files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'swpppp-reports' AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Office admin delete swpppp files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'swpppp-reports' AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

-- Notify on new report: foreman of the job + office + admin
CREATE OR REPLACE FUNCTION public.notify_swpppp_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_name text;
  v_job_number text;
  v_foreman uuid;
  v_label text;
  v_link text;
  v_body text;
BEGIN
  SELECT j.name, j.job_number, j.foreman_id
    INTO v_job_name, v_job_number, v_foreman
  FROM public.jobs j WHERE j.id = NEW.job_id;

  v_label := COALESCE(NULLIF(v_job_number,'') || ' · ' || v_job_name, v_job_name, 'a job');
  v_link := '/jobs/' || NEW.job_id::text;
  v_body := 'New SWPPP report for ' || v_label || ' (week of ' || to_char(NEW.week_of,'Mon DD') || ')';

  IF v_foreman IS NOT NULL THEN
    PERFORM public.notify_user(v_foreman, 'swpppp_report', 'New SWPPP report', v_body, v_link,
      jsonb_build_object('report_id', NEW.id, 'job_id', NEW.job_id));
  END IF;
  PERFORM public.notify_role('office'::app_role, 'swpppp_report', 'New SWPPP report', v_body, v_link,
    jsonb_build_object('report_id', NEW.id, 'job_id', NEW.job_id));
  PERFORM public.notify_role('admin'::app_role, 'swpppp_report', 'New SWPPP report', v_body, v_link,
    jsonb_build_object('report_id', NEW.id, 'job_id', NEW.job_id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_swpppp_report
  AFTER INSERT ON public.swpppp_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_swpppp_report();