
-- Restore full SELECT grant; rely on RLS for row-level restriction
GRANT SELECT ON public.employee_contacts TO authenticated;

DROP POLICY IF EXISTS "Authenticated read active employee contacts" ON public.employee_contacts;

CREATE POLICY "Office admin or self view employee contacts"
ON public.employee_contacts FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'office'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR converted_user_id = auth.uid()
);

-- Directory function (security definer) for non-office reads of safe fields
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
  is_active boolean,
  converted_user_id uuid,
  manager_contact_id uuid,
  hire_date date,
  date_of_birth date,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, first_name, last_name, middle_initial,
         job_title, department, phone, email, work_email,
         is_active, converted_user_id, manager_contact_id,
         hire_date, date_of_birth, created_at, updated_at
  FROM public.employee_contacts
  WHERE is_active = true OR converted_user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.list_employee_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_employee_directory() TO authenticated;
