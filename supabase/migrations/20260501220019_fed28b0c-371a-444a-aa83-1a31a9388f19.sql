CREATE UNIQUE INDEX IF NOT EXISTS employee_contacts_name_unique
  ON public.employee_contacts (lower(btrim(name)));