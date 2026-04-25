-- Employee contacts directory (separate from auth users)
CREATE TABLE public.employee_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  job_title TEXT,
  department TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view employee contacts"
ON public.employee_contacts FOR SELECT
TO authenticated
USING (is_active = true OR has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Foreman office admin insert employee contacts"
ON public.employee_contacts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'foreman'::app_role) OR has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Foreman office admin update employee contacts"
ON public.employee_contacts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'foreman'::app_role) OR has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin delete employee contacts"
ON public.employee_contacts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER employee_contacts_set_updated_at
BEFORE UPDATE ON public.employee_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_employee_contacts_name ON public.employee_contacts(name);
CREATE INDEX idx_employee_contacts_department ON public.employee_contacts(department);