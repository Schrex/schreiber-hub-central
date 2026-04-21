
-- =========================================================
-- 1. RESTRICT PAY BANDS ON positions
-- =========================================================
DROP POLICY IF EXISTS "Anyone signed in can view active positions" ON public.positions;

CREATE POLICY "Admins view all positions"
  ON public.positions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Public-safe view (no pay bands)
CREATE OR REPLACE VIEW public.positions_public
WITH (security_invoker = on) AS
SELECT id, title, description, is_active, is_salaried, sort_order
FROM public.positions
WHERE is_active = true OR public.has_role(auth.uid(), 'admin'::app_role);

GRANT SELECT ON public.positions_public TO authenticated;

-- =========================================================
-- 2. AUDIT LOG TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.pay_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  affected_user_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_by uuid,
  changed_by_email text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pay_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit log"
  ON public.pay_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE/DELETE policies = only triggers (SECURITY DEFINER) can write

CREATE INDEX idx_pay_audit_log_user ON public.pay_audit_log(affected_user_id, created_at DESC);
CREATE INDEX idx_pay_audit_log_table ON public.pay_audit_log(table_name, created_at DESC);

-- =========================================================
-- 3. AUDIT TRIGGER FUNCTION
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_pay_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS audit_employee_positions ON public.employee_positions;
CREATE TRIGGER audit_employee_positions
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_positions
  FOR EACH ROW EXECUTE FUNCTION public.log_pay_change();

DROP TRIGGER IF EXISTS audit_employee_benefits ON public.employee_benefits;
CREATE TRIGGER audit_employee_benefits
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_benefits
  FOR EACH ROW EXECUTE FUNCTION public.log_pay_change();

DROP TRIGGER IF EXISTS audit_employee_comp_history ON public.employee_compensation_history;
CREATE TRIGGER audit_employee_comp_history
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_compensation_history
  FOR EACH ROW EXECUTE FUNCTION public.log_pay_change();

-- =========================================================
-- 4. VALIDATION TRIGGERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_pay_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'employee_positions' AND NEW.pay_rate < 0 THEN
    RAISE EXCEPTION 'pay_rate cannot be negative';
  END IF;
  IF TG_TABLE_NAME = 'employee_benefits' AND NEW.annual_value < 0 THEN
    RAISE EXCEPTION 'annual_value cannot be negative';
  END IF;
  IF NEW.end_date IS NOT NULL AND NEW.effective_date IS NOT NULL AND NEW.end_date < NEW.effective_date THEN
    RAISE EXCEPTION 'end_date must be on or after effective_date';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_employee_positions ON public.employee_positions;
CREATE TRIGGER validate_employee_positions
  BEFORE INSERT OR UPDATE ON public.employee_positions
  FOR EACH ROW EXECUTE FUNCTION public.validate_pay_record();

DROP TRIGGER IF EXISTS validate_employee_benefits ON public.employee_benefits;
CREATE TRIGGER validate_employee_benefits
  BEFORE INSERT OR UPDATE ON public.employee_benefits
  FOR EACH ROW EXECUTE FUNCTION public.validate_pay_record();

CREATE OR REPLACE FUNCTION public.validate_comp_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS validate_comp_history_trg ON public.employee_compensation_history;
CREATE TRIGGER validate_comp_history_trg
  BEFORE INSERT OR UPDATE ON public.employee_compensation_history
  FOR EACH ROW EXECUTE FUNCTION public.validate_comp_history();

-- =========================================================
-- 5. HARDEN EXISTING FUNCTIONS (search_path)
-- =========================================================
CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;
