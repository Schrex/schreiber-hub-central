-- Vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendors_name ON public.vendors (lower(name));
CREATE INDEX idx_vendors_category ON public.vendors (category);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can view active vendors (office/admin can see all)
CREATE POLICY "Anyone signed in can view vendors"
ON public.vendors FOR SELECT
TO authenticated
USING (
  is_active = true
  OR public.has_role(auth.uid(), 'office'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Foreman, office, admin can insert
CREATE POLICY "Foreman office admin insert vendors"
ON public.vendors FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'foreman'::app_role)
  OR public.has_role(auth.uid(), 'office'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Foreman, office, admin can update
CREATE POLICY "Foreman office admin update vendors"
ON public.vendors FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'foreman'::app_role)
  OR public.has_role(auth.uid(), 'office'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Office, admin can delete
CREATE POLICY "Office admin delete vendors"
ON public.vendors FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'office'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE TRIGGER update_vendors_updated_at
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();