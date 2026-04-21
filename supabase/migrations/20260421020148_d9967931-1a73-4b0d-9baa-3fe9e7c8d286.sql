
DROP FUNCTION IF EXISTS public.validate_pay_record() CASCADE;

CREATE OR REPLACE FUNCTION public.validate_employee_position()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.pay_rate < 0 THEN
    RAISE EXCEPTION 'pay_rate cannot be negative';
  END IF;
  IF NEW.end_date IS NOT NULL AND NEW.effective_date IS NOT NULL AND NEW.end_date < NEW.effective_date THEN
    RAISE EXCEPTION 'end_date must be on or after effective_date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_employee_benefit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.annual_value < 0 THEN
    RAISE EXCEPTION 'annual_value cannot be negative';
  END IF;
  IF NEW.end_date IS NOT NULL AND NEW.effective_date IS NOT NULL AND NEW.end_date < NEW.effective_date THEN
    RAISE EXCEPTION 'end_date must be on or after effective_date';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_employee_position_trigger ON public.employee_positions;
CREATE TRIGGER validate_employee_position_trigger
  BEFORE INSERT OR UPDATE ON public.employee_positions
  FOR EACH ROW EXECUTE FUNCTION public.validate_employee_position();

DROP TRIGGER IF EXISTS validate_employee_benefit_trigger ON public.employee_benefits;
CREATE TRIGGER validate_employee_benefit_trigger
  BEFORE INSERT OR UPDATE ON public.employee_benefits
  FOR EACH ROW EXECUTE FUNCTION public.validate_employee_benefit();

DROP TRIGGER IF EXISTS validate_comp_history_trigger ON public.employee_compensation_history;
CREATE TRIGGER validate_comp_history_trigger
  BEFORE INSERT OR UPDATE ON public.employee_compensation_history
  FOR EACH ROW EXECUTE FUNCTION public.validate_comp_history();
