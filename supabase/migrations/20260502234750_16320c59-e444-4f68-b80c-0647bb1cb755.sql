CREATE TABLE public.job_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  manager TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_contacts_job_id ON public.job_contacts(job_id);

ALTER TABLE public.job_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view job contacts"
ON public.job_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Office admin or assigned foreman insert job contacts"
ON public.job_contacts FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'office'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.foreman_id = auth.uid())
);

CREATE POLICY "Office admin or assigned foreman update job contacts"
ON public.job_contacts FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'office'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.foreman_id = auth.uid())
);

CREATE POLICY "Office admin or assigned foreman delete job contacts"
ON public.job_contacts FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'office'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.foreman_id = auth.uid())
);

CREATE TRIGGER update_job_contacts_updated_at
BEFORE UPDATE ON public.job_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();