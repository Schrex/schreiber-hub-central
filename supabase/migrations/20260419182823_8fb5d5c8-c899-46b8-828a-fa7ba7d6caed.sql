
-- Enums
CREATE TYPE public.dig_ticket_status AS ENUM ('requested', 'marked', 'cleared', 'expired', 'cancelled');
CREATE TYPE public.dig_ticket_request_type AS ENUM ('normal', 'emergency', 'update', 'remark');
CREATE TYPE public.permit_status AS ENUM ('not_started', 'applied', 'in_review', 'approved', 'issued', 'expired', 'denied');

-- Dig tickets (811 / Exactix)
CREATE TABLE public.dig_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  ticket_number TEXT,
  status public.dig_ticket_status NOT NULL DEFAULT 'requested',
  request_type public.dig_ticket_request_type NOT NULL DEFAULT 'normal',
  work_description TEXT,
  requested_by_name TEXT,
  requested_at TIMESTAMP WITH TIME ZONE,
  dig_start_date DATE,
  dig_end_date DATE,
  expiration_date DATE,
  response_notes TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_dig_tickets_job ON public.dig_tickets(job_id);
CREATE INDEX idx_dig_tickets_status ON public.dig_tickets(status);

ALTER TABLE public.dig_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view dig tickets"
  ON public.dig_tickets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Foreman office admin insert dig tickets"
  ON public.dig_tickets FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'foreman') OR
    public.has_role(auth.uid(), 'office') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Foreman office admin update dig tickets"
  ON public.dig_tickets FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'foreman') OR
    public.has_role(auth.uid(), 'office') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Foreman office admin delete dig tickets"
  ON public.dig_tickets FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'foreman') OR
    public.has_role(auth.uid(), 'office') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_dig_tickets_updated_at
  BEFORE UPDATE ON public.dig_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Job permits
CREATE TABLE public.job_permits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  permit_type TEXT NOT NULL,
  permit_number TEXT,
  status public.permit_status NOT NULL DEFAULT 'not_started',
  responsible_user_id UUID,
  responsible_name TEXT,
  issuing_agency TEXT,
  issue_date DATE,
  expiration_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_permits_job ON public.job_permits(job_id);
CREATE INDEX idx_job_permits_status ON public.job_permits(status);

ALTER TABLE public.job_permits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view permits"
  ON public.job_permits FOR SELECT TO authenticated USING (true);

CREATE POLICY "Foreman office admin insert permits"
  ON public.job_permits FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'foreman') OR
    public.has_role(auth.uid(), 'office') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Foreman office admin update permits"
  ON public.job_permits FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'foreman') OR
    public.has_role(auth.uid(), 'office') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Foreman office admin delete permits"
  ON public.job_permits FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'foreman') OR
    public.has_role(auth.uid(), 'office') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_job_permits_updated_at
  BEFORE UPDATE ON public.job_permits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
