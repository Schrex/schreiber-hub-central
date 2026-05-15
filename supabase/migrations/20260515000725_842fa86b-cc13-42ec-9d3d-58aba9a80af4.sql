
-- 1. Remove the over-permissive SELECT policy on employee_contacts
DROP POLICY IF EXISTS "Anyone signed in view active employee contacts" ON public.employee_contacts;

-- 2. Expand the directory RPC. Returns safe columns for everyone; office/admin/self get the full set.
DROP FUNCTION IF EXISTS public.list_employee_directory();

CREATE OR REPLACE FUNCTION public.list_employee_directory()
RETURNS TABLE(
  id uuid,
  name text,
  first_name text,
  last_name text,
  middle_initial text,
  job_title text,
  department text,
  phone text,
  email text,
  work_email text,
  personal_email text,
  address text,
  notes text,
  is_active boolean,
  created_by uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  converted_user_id uuid,
  date_of_birth date,
  drivers_license_class text,
  drivers_license_expires date,
  osha_card_number text,
  osha_expires date,
  other_certifications text,
  hire_date date,
  termination_date date,
  manager_contact_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ec.id,
    ec.name,
    ec.first_name,
    ec.last_name,
    ec.middle_initial,
    ec.job_title,
    ec.department,
    ec.phone,
    ec.email,
    ec.work_email,
    ec.personal_email,
    ec.address,
    -- Sensitive / internal fields: only office, admin, or the employee themselves
    CASE WHEN public.has_role(auth.uid(), 'office'::app_role)
              OR public.has_role(auth.uid(), 'admin'::app_role)
              OR ec.converted_user_id = auth.uid()
         THEN ec.notes ELSE NULL END AS notes,
    ec.is_active,
    ec.created_by,
    ec.created_at,
    ec.updated_at,
    ec.converted_user_id,
    CASE WHEN public.has_role(auth.uid(), 'office'::app_role)
              OR public.has_role(auth.uid(), 'admin'::app_role)
              OR ec.converted_user_id = auth.uid()
         THEN ec.date_of_birth ELSE NULL END AS date_of_birth,
    ec.drivers_license_class,
    ec.drivers_license_expires,
    ec.osha_card_number,
    ec.osha_expires,
    ec.other_certifications,
    ec.hire_date,
    CASE WHEN public.has_role(auth.uid(), 'office'::app_role)
              OR public.has_role(auth.uid(), 'admin'::app_role)
         THEN ec.termination_date ELSE NULL END AS termination_date,
    ec.manager_contact_id
  FROM public.employee_contacts ec
  WHERE ec.is_active = true OR ec.converted_user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.list_employee_directory() TO authenticated;

-- 3. Add UPDATE policy on accident-photos storage bucket (office/admin only)
CREATE POLICY "Office and admins can update accident-photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'accident-photos' AND (public.has_role(auth.uid(), 'office'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (bucket_id = 'accident-photos' AND (public.has_role(auth.uid(), 'office'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)));
