-- Drop the security-definer view (flagged by linter); use column-level grants instead.
DROP VIEW IF EXISTS public.employee_contacts_directory;

-- Allow all signed-in users to SEE active employee contacts (rows).
-- Sensitive columns are blocked separately via column-level GRANTs below.
DROP POLICY IF EXISTS "Anyone signed in view active employee contacts" ON public.employee_contacts;
CREATE POLICY "Anyone signed in view active employee contacts"
  ON public.employee_contacts
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR converted_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'office'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Column-level access: revoke broad SELECT, grant only the safe columns to
-- regular authenticated users. Office/admin continue reading sensitive data
-- through the existing get_employee_contact_sensitive() security-definer
-- function (and via service_role for backend code).
REVOKE SELECT ON public.employee_contacts FROM authenticated;

GRANT SELECT (
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
) ON public.employee_contacts TO authenticated;