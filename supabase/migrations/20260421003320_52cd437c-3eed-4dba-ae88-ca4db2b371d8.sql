-- Positions catalog
CREATE TABLE public.positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  description TEXT,
  min_pay_rate NUMERIC(10,2) NOT NULL,
  max_pay_rate NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT positions_pay_range_valid CHECK (max_pay_rate >= min_pay_rate)
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view active positions"
  ON public.positions FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert positions"
  ON public.positions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update positions"
  ON public.positions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete positions"
  ON public.positions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Employee position + pay assignments (also acts as history)
CREATE TABLE public.employee_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE RESTRICT,
  pay_rate NUMERIC(10,2) NOT NULL,
  effective_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'America/New_York'::text))::date,
  end_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_employee_positions_user ON public.employee_positions(user_id, effective_date DESC);

ALTER TABLE public.employee_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees view own position history"
  ON public.employee_positions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all employee positions"
  ON public.employee_positions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert employee positions"
  ON public.employee_positions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update employee positions"
  ON public.employee_positions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete employee positions"
  ON public.employee_positions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_employee_positions_updated_at
  BEFORE UPDATE ON public.employee_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();