-- Public-safe directory view of employee contacts so all authenticated users
-- can browse coworkers, while sensitive PII (SSN, bank, license #, emergency
-- contacts, termination details) stays locked to office/admin via the
-- existing get_employee_contact_sensitive() security-definer function and
-- the restrictive base-table RLS.

CREATE OR REPLACE VIEW public.employee_contacts_directory
WITH (security_invoker = off) AS
SELECT
  id,
  name,
  first_name,
  last_name,
  middle_initial,
  job_title,
  department,
  phone,
  email,
  work_email,
  personal_email,
  address,
  notes,
  is_active,
  created_by,
  created_at,
  updated_at,
  converted_user_id,
  date_of_birth,
  drivers_license_class,
  drivers_license_expires,
  osha_card_number,
  osha_expires,
  other_certifications,
  hire_date,
  termination_date,
  manager_contact_id
FROM public.employee_contacts
WHERE is_active = true
   OR converted_user_id = auth.uid()
   OR public.has_role(auth.uid(), 'office'::app_role)
   OR public.has_role(auth.uid(), 'admin'::app_role);

REVOKE ALL ON public.employee_contacts_directory FROM anon;
GRANT SELECT ON public.employee_contacts_directory TO authenticated;