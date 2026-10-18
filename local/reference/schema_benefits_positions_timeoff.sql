-- Server: PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
-- Metadata extracted at: 2026-10-16 20:32:43.34648+00 (read-only catalog inspection)
-- Missing objects: none

-- ===== ENUM TYPES used by these tables =====
CREATE TYPE public.app_role AS ENUM ('employee', 'foreman', 'office', 'admin');
CREATE TYPE public.time_off_half_day AS ENUM ('none', 'am', 'pm');
CREATE TYPE public.time_off_status AS ENUM ('pending', 'approved', 'denied', 'cancelled');
CREATE TYPE public.time_off_type AS ENUM ('vacation', 'sick', 'personal', 'other');

-- ===== TABLES / VIEWS =====

-- benefit_types (relkind=r, rls_enabled=true, rls_forced=false)
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

-- employee_benefits (relkind=r, rls_enabled=true, rls_forced=false)
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

-- employee_compensation_history (relkind=r, rls_enabled=true, rls_forced=false)
CREATE TABLE public.employee_compensation_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  year integer NOT NULL,
  base_salary numeric(12,2) DEFAULT 0 NOT NULL,
  bonus numeric(12,2) DEFAULT 0 NOT NULL,
  benefits_value numeric(12,2) DEFAULT 0 NOT NULL,
  total_compensation numeric(12,2) DEFAULT ((base_salary + bonus) + benefits_value) /*generated*/,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- employee_positions (relkind=r, rls_enabled=true, rls_forced=false)
CREATE TABLE public.employee_positions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  position_id uuid NOT NULL,
  pay_rate numeric(10,2) NOT NULL,
  effective_date date DEFAULT ((now() AT TIME ZONE 'America/New_York'::text))::date NOT NULL,
  end_date date,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  is_salaried boolean DEFAULT false NOT NULL
);

-- positions (relkind=r, rls_enabled=true, rls_forced=false)
CREATE TABLE public.positions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  description text,
  min_pay_rate numeric(10,2) NOT NULL,
  max_pay_rate numeric(10,2) NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  is_salaried boolean DEFAULT false NOT NULL
);

-- positions_public (relkind=v, rls_enabled=false, rls_forced=false)
CREATE OR REPLACE VIEW public.positions_public WITH (security_invoker=on) AS
 SELECT id,
    title,
    description,
    is_active,
    is_salaried,
    sort_order
   FROM positions
  WHERE is_active = true OR has_role(auth.uid(), 'admin'::app_role);

-- time_off_requests (relkind=r, rls_enabled=true, rls_forced=false)
CREATE TABLE public.time_off_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  requester_name text,
  type time_off_type DEFAULT 'vacation'::time_off_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  half_day time_off_half_day DEFAULT 'none'::time_off_half_day NOT NULL,
  reason text,
  status time_off_status DEFAULT 'pending'::time_off_status NOT NULL,
  denial_reason text,
  decided_by uuid,
  decided_at timestamp with time zone,
  invites_sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== CONSTRAINTS (PK/UNIQUE/CHECK/FK) =====
ALTER TABLE public.benefit_types ADD CONSTRAINT benefit_types_name_key UNIQUE (name);
ALTER TABLE public.benefit_types ADD CONSTRAINT benefit_types_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_benefits ADD CONSTRAINT employee_benefits_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_benefits ADD CONSTRAINT employee_benefits_benefit_type_id_fkey FOREIGN KEY (benefit_type_id) REFERENCES benefit_types(id) ON DELETE RESTRICT;
ALTER TABLE public.employee_compensation_history ADD CONSTRAINT employee_compensation_history_user_id_year_key UNIQUE (user_id, year);
ALTER TABLE public.employee_compensation_history ADD CONSTRAINT employee_compensation_history_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_positions ADD CONSTRAINT employee_positions_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_positions ADD CONSTRAINT employee_positions_position_id_fkey FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE RESTRICT;
ALTER TABLE public.positions ADD CONSTRAINT positions_title_key UNIQUE (title);
ALTER TABLE public.positions ADD CONSTRAINT positions_pkey PRIMARY KEY (id);
ALTER TABLE public.positions ADD CONSTRAINT positions_pay_range_valid CHECK ((max_pay_rate >= min_pay_rate));
ALTER TABLE public.time_off_requests ADD CONSTRAINT time_off_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.time_off_requests ADD CONSTRAINT time_off_dates_valid CHECK ((end_date >= start_date));

-- FK referenced objects (outside set): benefit_types, positions

-- ===== INDEXES (non-constraint) =====
CREATE INDEX idx_comp_history_user_year ON public.employee_compensation_history USING btree (user_id, year DESC);
CREATE INDEX idx_employee_benefits_user ON public.employee_benefits USING btree (user_id);
CREATE INDEX idx_employee_positions_user ON public.employee_positions USING btree (user_id, effective_date DESC);
CREATE INDEX idx_time_off_dates ON public.time_off_requests USING btree (start_date, end_date);
CREATE INDEX idx_time_off_status ON public.time_off_requests USING btree (status);
CREATE INDEX idx_time_off_user ON public.time_off_requests USING btree (user_id);

-- ===== RLS =====
ALTER TABLE public.benefit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_compensation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- ===== POLICIES =====
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
CREATE POLICY "Admins delete employee positions" ON public.employee_positions AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert employee positions" ON public.employee_positions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update employee positions" ON public.employee_positions AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all employee positions" ON public.employee_positions AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Employees view own position history" ON public.employee_positions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));
CREATE POLICY "Admins delete positions" ON public.positions AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert positions" ON public.positions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update positions" ON public.positions AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all positions" ON public.positions AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Employees view own assigned position" ON public.positions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM employee_positions ep
  WHERE ((ep.position_id = positions.id) AND (ep.user_id = auth.uid())))));
CREATE POLICY "Admins delete any time off" ON public.time_off_requests AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update any time off" ON public.time_off_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all time off" ON public.time_off_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users cancel own pending" ON public.time_off_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.uid() = user_id) AND (status = 'pending'::time_off_status)));
CREATE POLICY "Users delete own pending" ON public.time_off_requests AS PERMISSIVE FOR DELETE TO authenticated
  USING (((auth.uid() = user_id) AND (status = 'pending'::time_off_status)));
CREATE POLICY "Users insert own time off" ON public.time_off_requests AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users view own time off" ON public.time_off_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

-- ===== GRANTS =====
GRANT INSERT, SELECT ON public.benefit_types TO sandbox_exec;
GRANT INSERT, SELECT ON public.employee_benefits TO sandbox_exec;
GRANT INSERT, SELECT ON public.employee_compensation_history TO sandbox_exec;
GRANT INSERT, SELECT ON public.employee_positions TO sandbox_exec;
GRANT INSERT, SELECT ON public.positions TO sandbox_exec;
GRANT INSERT, SELECT ON public.positions_public TO sandbox_exec;
GRANT INSERT, SELECT ON public.time_off_requests TO sandbox_exec;

-- ===== TRIGGERS =====
CREATE TRIGGER update_benefit_types_updated_at BEFORE UPDATE ON public.benefit_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER audit_employee_benefits AFTER INSERT OR DELETE OR UPDATE ON public.employee_benefits FOR EACH ROW EXECUTE FUNCTION log_pay_change();
CREATE TRIGGER update_employee_benefits_updated_at BEFORE UPDATE ON public.employee_benefits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER validate_employee_benefit_trigger BEFORE INSERT OR UPDATE ON public.employee_benefits FOR EACH ROW EXECUTE FUNCTION validate_employee_benefit();
CREATE TRIGGER audit_employee_comp_history AFTER INSERT OR DELETE OR UPDATE ON public.employee_compensation_history FOR EACH ROW EXECUTE FUNCTION log_pay_change();
CREATE TRIGGER update_comp_history_updated_at BEFORE UPDATE ON public.employee_compensation_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER validate_comp_history_trg BEFORE INSERT OR UPDATE ON public.employee_compensation_history FOR EACH ROW EXECUTE FUNCTION validate_comp_history();
CREATE TRIGGER validate_comp_history_trigger BEFORE INSERT OR UPDATE ON public.employee_compensation_history FOR EACH ROW EXECUTE FUNCTION validate_comp_history();
CREATE TRIGGER audit_employee_positions AFTER INSERT OR DELETE OR UPDATE ON public.employee_positions FOR EACH ROW EXECUTE FUNCTION log_pay_change();
CREATE TRIGGER update_employee_positions_updated_at BEFORE UPDATE ON public.employee_positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER validate_employee_position_trigger BEFORE INSERT OR UPDATE ON public.employee_positions FOR EACH ROW EXECUTE FUNCTION validate_employee_position();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_notify_time_off AFTER INSERT OR UPDATE ON public.time_off_requests FOR EACH ROW EXECUTE FUNCTION notify_time_off_changes();
CREATE TRIGGER update_time_off_updated_at BEFORE UPDATE ON public.time_off_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== FUNCTIONS (has_role, trigger functions, and functions referenced in policies/defaults/views) =====
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$
;
-- ACL: =X/postgres
-- ACL: postgres=X/postgres
-- ACL: anon=X/postgres
-- ACL: authenticated=X/postgres
-- ACL: service_role=X/postgres
CREATE OR REPLACE FUNCTION public.log_pay_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  v_user_id := auth.uid();
  SELECT email INTO v_email FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.pay_audit_log(table_name, record_id, affected_user_id, action, changed_by, changed_by_email, old_values)
    VALUES (TG_TABLE_NAME, OLD.id, OLD.user_id, 'DELETE', v_user_id, v_email, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.pay_audit_log(table_name, record_id, affected_user_id, action, changed_by, changed_by_email, old_values, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, NEW.user_id, 'UPDATE', v_user_id, v_email, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO public.pay_audit_log(table_name, record_id, affected_user_id, action, changed_by, changed_by_email, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, NEW.user_id, 'INSERT', v_user_id, v_email, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$function$
;
-- ACL: postgres=X/postgres
-- ACL: service_role=X/postgres
CREATE OR REPLACE FUNCTION public.notify_time_off_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_role('office'::app_role, 'time_off_new', 'New time off request',
      COALESCE(NEW.requester_name,'Someone') || ' requested ' || NEW.type::text || ' from ' || to_char(NEW.start_date,'Mon DD') || ' to ' || to_char(NEW.end_date,'Mon DD'),
      '/time-off', jsonb_build_object('request_id', NEW.id));
    PERFORM public.notify_role('admin'::app_role, 'time_off_new', 'New time off request',
      COALESCE(NEW.requester_name,'Someone') || ' requested ' || NEW.type::text || ' from ' || to_char(NEW.start_date,'Mon DD') || ' to ' || to_char(NEW.end_date,'Mon DD'),
      '/time-off', jsonb_build_object('request_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status::text IN ('approved','denied') THEN
    PERFORM public.notify_user(NEW.user_id, 'time_off_decision',
      'Time off ' || NEW.status::text,
      'Your ' || NEW.type::text || ' request from ' || to_char(NEW.start_date,'Mon DD') || ' to ' || to_char(NEW.end_date,'Mon DD') || ' was ' || NEW.status::text || '.',
      '/time-off', jsonb_build_object('request_id', NEW.id, 'status', NEW.status::text));
  END IF;
  RETURN NEW;
END; $function$
;
-- ACL: postgres=X/postgres
-- ACL: service_role=X/postgres
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
-- ACL: =X/postgres
-- ACL: postgres=X/postgres
-- ACL: anon=X/postgres
-- ACL: authenticated=X/postgres
-- ACL: service_role=X/postgres
CREATE OR REPLACE FUNCTION public.validate_comp_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.base_salary < 0 OR NEW.bonus < 0 OR NEW.benefits_value < 0 THEN
    RAISE EXCEPTION 'compensation values cannot be negative';
  END IF;
  IF NEW.year < 1900 OR NEW.year > extract(year from now())::int + 1 THEN
    RAISE EXCEPTION 'invalid year';
  END IF;
  NEW.total_compensation := NEW.base_salary + NEW.bonus + NEW.benefits_value;
  RETURN NEW;
END;
$function$
;
-- ACL: =X/postgres
-- ACL: postgres=X/postgres
-- ACL: anon=X/postgres
-- ACL: authenticated=X/postgres
-- ACL: service_role=X/postgres
CREATE OR REPLACE FUNCTION public.validate_employee_benefit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.annual_value < 0 THEN
    RAISE EXCEPTION 'annual_value cannot be negative';
  END IF;
  IF NEW.end_date IS NOT NULL AND NEW.effective_date IS NOT NULL AND NEW.end_date < NEW.effective_date THEN
    RAISE EXCEPTION 'end_date must be on or after effective_date';
  END IF;
  RETURN NEW;
END;
$function$
;
-- ACL: =X/postgres
-- ACL: postgres=X/postgres
-- ACL: anon=X/postgres
-- ACL: authenticated=X/postgres
-- ACL: service_role=X/postgres
CREATE OR REPLACE FUNCTION public.validate_employee_position()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.pay_rate < 0 THEN
    RAISE EXCEPTION 'pay_rate cannot be negative';
  END IF;
  IF NEW.end_date IS NOT NULL AND NEW.effective_date IS NOT NULL AND NEW.end_date < NEW.effective_date THEN
    RAISE EXCEPTION 'end_date must be on or after effective_date';
  END IF;
  RETURN NEW;
END;
$function$
;
-- ACL: =X/postgres
-- ACL: postgres=X/postgres
-- ACL: anon=X/postgres
-- ACL: authenticated=X/postgres
-- ACL: service_role=X/postgres
