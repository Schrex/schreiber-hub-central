-- LOCAL ONLY: reconstructed from the supplied Cloud catalog export (2026-10-16).
-- Not a production migration. Existing production tables must not be recreated.
-- The export marks total_compensation generated but renders it as DEFAULT.
-- PostgreSQL 17 supports stored generated columns; normalize that serialization.
-- Complete production ACL parity remains unverified. Local default grants apply.

CREATE TABLE public.benefit_types (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  default_annual_value numeric(10,2),
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.employee_benefits (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  benefit_type_id uuid NOT NULL,
  annual_value numeric(10,2) NOT NULL,
  effective_date date DEFAULT ((now() AT TIME ZONE 'America/New_York'::text))::date NOT NULL,
  end_date date,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.employee_compensation_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  year integer NOT NULL,
  base_salary numeric(12,2) DEFAULT 0 NOT NULL,
  bonus numeric(12,2) DEFAULT 0 NOT NULL,
  benefits_value numeric(12,2) DEFAULT 0 NOT NULL,
  total_compensation numeric(12,2) GENERATED ALWAYS AS ((base_salary + bonus) + benefits_value) STORED,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.benefit_types ADD CONSTRAINT benefit_types_name_key UNIQUE (name);
ALTER TABLE public.benefit_types ADD CONSTRAINT benefit_types_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_benefits ADD CONSTRAINT employee_benefits_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_benefits ADD CONSTRAINT employee_benefits_benefit_type_id_fkey FOREIGN KEY (benefit_type_id) REFERENCES benefit_types(id) ON DELETE RESTRICT;
ALTER TABLE public.employee_compensation_history ADD CONSTRAINT employee_compensation_history_user_id_year_key UNIQUE (user_id, year);
ALTER TABLE public.employee_compensation_history ADD CONSTRAINT employee_compensation_history_pkey PRIMARY KEY (id);
CREATE INDEX idx_comp_history_user_year ON public.employee_compensation_history USING btree (user_id, year DESC);
CREATE INDEX idx_employee_benefits_user ON public.employee_benefits USING btree (user_id);
ALTER TABLE public.benefit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_compensation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins delete benefit types" ON public.benefit_types AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert benefit types" ON public.benefit_types AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update benefit types" ON public.benefit_types AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone signed in can view active benefit types" ON public.benefit_types AS PERMISSIVE FOR SELECT TO authenticated
  USING (((is_active = true) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins delete benefits" ON public.employee_benefits AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert benefits" ON public.employee_benefits AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update benefits" ON public.employee_benefits AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all benefits" ON public.employee_benefits AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Employees view own benefits" ON public.employee_benefits AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));
CREATE POLICY "Admins delete comp history" ON public.employee_compensation_history AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert comp history" ON public.employee_compensation_history AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update comp history" ON public.employee_compensation_history AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all comp history" ON public.employee_compensation_history AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Employees view own comp history" ON public.employee_compensation_history AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));
CREATE TRIGGER update_benefit_types_updated_at BEFORE UPDATE ON public.benefit_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employee_benefits_updated_at BEFORE UPDATE ON public.employee_benefits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comp_history_updated_at BEFORE UPDATE ON public.employee_compensation_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
