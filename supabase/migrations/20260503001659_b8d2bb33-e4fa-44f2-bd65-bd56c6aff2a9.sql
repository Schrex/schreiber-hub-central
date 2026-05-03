DO $$ BEGIN
  CREATE TYPE violation_disciplinary_action AS ENUM ('verbal','written','suspension','termination');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE violation_status AS ENUM ('open','acknowledged','resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.safety_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid,
  job_name_snapshot text,
  job_number_snapshot text,

  employee_contact_id uuid,
  employee_name text NOT NULL,
  department text,
  violation_date date NOT NULL,

  -- up to 3 rule violation rows
  violations jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- shape: [{ rule: text, description: text, corrective_codes: int[], corrective_other: text }, ...]

  comments text,

  disciplinary_action violation_disciplinary_action NOT NULL DEFAULT 'verbal',
  suspension_from date,
  suspension_to date,

  photo_paths text[] NOT NULL DEFAULT '{}',
  supervisor_signature_path text,
  employee_signature_path text,
  employee_acknowledged boolean NOT NULL DEFAULT false,

  status violation_status NOT NULL DEFAULT 'open',
  office_notes text,

  filed_by uuid NOT NULL,
  filed_by_name text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Foreman office admin file violations"
  ON public.safety_violations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = filed_by AND (
      has_role(auth.uid(),'foreman'::app_role) OR
      has_role(auth.uid(),'office'::app_role) OR
      has_role(auth.uid(),'admin'::app_role)
    )
  );

CREATE POLICY "Filer views own violations"
  ON public.safety_violations FOR SELECT TO authenticated
  USING (auth.uid() = filed_by);

CREATE POLICY "Office admin view all violations"
  ON public.safety_violations FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Office admin update violations"
  ON public.safety_violations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admin delete violations"
  ON public.safety_violations FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER update_safety_violations_updated_at
  BEFORE UPDATE ON public.safety_violations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_safety_violations_job ON public.safety_violations(job_id);
CREATE INDEX IF NOT EXISTS idx_safety_violations_filed_by ON public.safety_violations(filed_by);
CREATE INDEX IF NOT EXISTS idx_safety_violations_employee ON public.safety_violations(employee_contact_id);

-- Notify office + admin on new violation
CREATE OR REPLACE FUNCTION public.notify_safety_violation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_label text;
BEGIN
  v_label := COALESCE(NULLIF(NEW.job_name_snapshot,''), 'a job');
  PERFORM public.notify_role('office'::app_role, 'safety_violation',
    'Safety violation filed',
    COALESCE(NEW.filed_by_name,'Someone') || ' issued a violation to ' || NEW.employee_name || ' on ' || v_label,
    '/safety/violations/' || NEW.id::text,
    jsonb_build_object('violation_id', NEW.id, 'discipline', NEW.disciplinary_action::text));
  PERFORM public.notify_role('admin'::app_role, 'safety_violation',
    'Safety violation filed',
    COALESCE(NEW.filed_by_name,'Someone') || ' issued a violation to ' || NEW.employee_name || ' on ' || v_label,
    '/safety/violations/' || NEW.id::text,
    jsonb_build_object('violation_id', NEW.id, 'discipline', NEW.disciplinary_action::text));
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_safety_violation
  AFTER INSERT ON public.safety_violations
  FOR EACH ROW EXECUTE FUNCTION public.notify_safety_violation();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('safety-violation-photos','safety-violation-photos',false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Filer view own violation files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='safety-violation-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Office admin view violation files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='safety-violation-photos' AND (has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "Foreman office admin upload violation files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id='safety-violation-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  );

CREATE POLICY "Office admin delete violation files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='safety-violation-photos' AND (has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role)));
