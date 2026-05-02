-- Enums
CREATE TYPE public.accident_incident_type AS ENUM ('injury', 'near_miss', 'property_damage', 'vehicle', 'other');
CREATE TYPE public.accident_severity AS ENUM ('none', 'first_aid', 'medical_treatment', 'lost_time', 'fatality');
CREATE TYPE public.accident_status AS ENUM ('submitted', 'in_review', 'closed');

-- Table
CREATE TABLE public.accident_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_name_snapshot TEXT,
  job_number_snapshot TEXT,
  reported_by UUID NOT NULL,
  reported_by_name TEXT NOT NULL,
  reported_by_email TEXT,
  incident_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  incident_type public.accident_incident_type NOT NULL DEFAULT 'injury',
  severity public.accident_severity NOT NULL DEFAULT 'none',
  description TEXT NOT NULL,
  injured_person_name TEXT,
  body_part TEXT,
  witnesses TEXT,
  immediate_action TEXT,
  contributing_factors TEXT,
  photo_paths TEXT[] NOT NULL DEFAULT '{}',
  signature_data TEXT,
  status public.accident_status NOT NULL DEFAULT 'submitted',
  office_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accident_reports_job_id ON public.accident_reports(job_id);
CREATE INDEX idx_accident_reports_reported_by ON public.accident_reports(reported_by);
CREATE INDEX idx_accident_reports_incident_at ON public.accident_reports(incident_at DESC);

ALTER TABLE public.accident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can file accident reports"
ON public.accident_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Users view own reports"
ON public.accident_reports FOR SELECT TO authenticated
USING (auth.uid() = reported_by);

CREATE POLICY "Office admin view all reports"
ON public.accident_reports FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin update reports"
ON public.accident_reports FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete reports"
ON public.accident_reports FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_accident_reports_updated_at
BEFORE UPDATE ON public.accident_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify office + admin in-app
CREATE OR REPLACE FUNCTION public.notify_accident_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_label text;
BEGIN
  v_label := COALESCE(NULLIF(NEW.job_name_snapshot, ''), 'a job');
  PERFORM public.notify_role('office'::app_role, 'accident_report',
    'Accident report filed',
    COALESCE(NEW.reported_by_name,'Someone') || ' filed a ' || NEW.incident_type::text || ' report for ' || v_label,
    '/safety/reports/' || NEW.id::text,
    jsonb_build_object('report_id', NEW.id, 'severity', NEW.severity::text));
  PERFORM public.notify_role('admin'::app_role, 'accident_report',
    'Accident report filed',
    COALESCE(NEW.reported_by_name,'Someone') || ' filed a ' || NEW.incident_type::text || ' report for ' || v_label,
    '/safety/reports/' || NEW.id::text,
    jsonb_build_object('report_id', NEW.id, 'severity', NEW.severity::text));
  RETURN NEW;
END; $$;

CREATE TRIGGER notify_accident_report_trigger
AFTER INSERT ON public.accident_reports
FOR EACH ROW EXECUTE FUNCTION public.notify_accident_report();

-- Storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('accident-photos', 'accident-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated upload accident photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'accident-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner views own accident photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'accident-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Office admin views all accident photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'accident-photos' AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Office admin deletes accident photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'accident-photos' AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));