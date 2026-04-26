-- Extra HR fields on employee_contacts
ALTER TABLE public.employee_contacts
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS ssn text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS drivers_license_number text,
  ADD COLUMN IF NOT EXISTS drivers_license_class text,
  ADD COLUMN IF NOT EXISTS drivers_license_expires date,
  ADD COLUMN IF NOT EXISTS osha_card_number text,
  ADD COLUMN IF NOT EXISTS osha_expires date,
  ADD COLUMN IF NOT EXISTS other_certifications text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_holder text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_routing_number text,
  ADD COLUMN IF NOT EXISTS bank_account_type text,
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS termination_date date,
  ADD COLUMN IF NOT EXISTS termination_reason text,
  ADD COLUMN IF NOT EXISTS terminated_by uuid;

-- Document template library
CREATE TABLE IF NOT EXISTS public.onboarding_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  is_built_in boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view active templates"
  ON public.onboarding_document_templates FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert templates"
  ON public.onboarding_document_templates FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update templates"
  ON public.onboarding_document_templates FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete templates"
  ON public.onboarding_document_templates FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_onboarding_templates_updated_at
  BEFORE UPDATE ON public.onboarding_document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Documents sent to a specific employee
CREATE TYPE public.onboarding_doc_status AS ENUM ('pending', 'viewed', 'signed', 'declined');

CREATE TABLE IF NOT EXISTS public.onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_id uuid REFERENCES public.onboarding_document_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  source_file_path text NOT NULL,
  signed_file_path text,
  status public.onboarding_doc_status NOT NULL DEFAULT 'pending',
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own documents"
  ON public.onboarding_documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users update own document status"
  ON public.onboarding_documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Office admin send documents"
  ON public.onboarding_documents FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Office admin delete documents"
  ON public.onboarding_documents FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_onboarding_documents_user ON public.onboarding_documents(user_id, status);

CREATE TRIGGER set_onboarding_documents_updated_at
  BEFORE UPDATE ON public.onboarding_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Signature record
CREATE TABLE IF NOT EXISTS public.onboarding_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.onboarding_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  typed_name text NOT NULL,
  signature_image text NOT NULL, -- base64 data URL of drawn signature
  signed_ip text,
  signed_user_agent text,
  signed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own signatures"
  ON public.onboarding_signatures FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own signatures"
  ON public.onboarding_signatures FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Storage buckets (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('onboarding-templates', 'onboarding-templates', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('onboarding-signed', 'onboarding-signed', false)
  ON CONFLICT (id) DO NOTHING;

-- Templates: any signed-in user can read, admins write
CREATE POLICY "Authenticated read templates"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'onboarding-templates');
CREATE POLICY "Admins write templates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'onboarding-templates' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update templates objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'onboarding-templates' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete templates objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'onboarding-templates' AND has_role(auth.uid(), 'admin'::app_role));

-- Signed: user reads their own (folder = user_id), office/admin read all, edge function writes
CREATE POLICY "Users read own signed docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'onboarding-signed' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'office'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );
CREATE POLICY "Users upload own signed docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'onboarding-signed' AND auth.uid()::text = (storage.foldername(name))[1]
  );