-- Enums
CREATE TYPE public.time_off_status AS ENUM ('pending', 'approved', 'denied', 'cancelled');
CREATE TYPE public.time_off_type AS ENUM ('vacation', 'sick', 'personal', 'other');
CREATE TYPE public.time_off_half_day AS ENUM ('none', 'am', 'pm');

-- Table
CREATE TABLE public.time_off_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  requester_name TEXT,
  type public.time_off_type NOT NULL DEFAULT 'vacation',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  half_day public.time_off_half_day NOT NULL DEFAULT 'none',
  reason TEXT,
  status public.time_off_status NOT NULL DEFAULT 'pending',
  denial_reason TEXT,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  invites_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT time_off_dates_valid CHECK (end_date >= start_date)
);

CREATE INDEX idx_time_off_user ON public.time_off_requests(user_id);
CREATE INDEX idx_time_off_status ON public.time_off_requests(status);
CREATE INDEX idx_time_off_dates ON public.time_off_requests(start_date, end_date);

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "Users insert own time off"
ON public.time_off_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own time off"
ON public.time_off_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users cancel own pending"
ON public.time_off_requests FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users delete own pending"
ON public.time_off_requests FOR DELETE TO authenticated
USING (auth.uid() = user_id AND status = 'pending');

-- Admin
CREATE POLICY "Admins view all time off"
ON public.time_off_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update any time off"
ON public.time_off_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete any time off"
ON public.time_off_requests FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_time_off_updated_at
BEFORE UPDATE ON public.time_off_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();