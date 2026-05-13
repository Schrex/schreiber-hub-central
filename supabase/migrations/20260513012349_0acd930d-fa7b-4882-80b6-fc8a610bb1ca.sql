
-- Revoke column-level SELECT on sensitive PII from regular auth roles.
-- RLS still controls row visibility; this adds defense-in-depth at the column level.
REVOKE SELECT (
  ssn,
  bank_account_number,
  bank_routing_number,
  bank_account_holder,
  bank_account_type,
  bank_name,
  drivers_license_number,
  emergency_contact_name,
  emergency_contact_phone,
  termination_reason,
  terminated_by
) ON public.employee_contacts FROM anon, authenticated;

-- Secure accessor for office/admin to read the sensitive fields when needed.
CREATE OR REPLACE FUNCTION public.get_employee_contact_sensitive(_id uuid)
RETURNS TABLE (
  id uuid,
  ssn text,
  bank_name text,
  bank_account_holder text,
  bank_account_number text,
  bank_routing_number text,
  bank_account_type text,
  drivers_license_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  termination_reason text,
  terminated_by uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'office'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT ec.id, ec.ssn, ec.bank_name, ec.bank_account_holder, ec.bank_account_number,
         ec.bank_routing_number, ec.bank_account_type, ec.drivers_license_number,
         ec.emergency_contact_name, ec.emergency_contact_phone, ec.termination_reason, ec.terminated_by
  FROM public.employee_contacts ec
  WHERE ec.id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_contact_sensitive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_contact_sensitive(uuid) TO authenticated;
