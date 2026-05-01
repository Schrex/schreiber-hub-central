ALTER TABLE public.employee_contacts
  ADD COLUMN IF NOT EXISTS work_email text,
  ADD COLUMN IF NOT EXISTS personal_email text;

-- Backfill: treat any existing email as the personal email by default
UPDATE public.employee_contacts
SET personal_email = email
WHERE personal_email IS NULL AND email IS NOT NULL;

-- Trigger to keep `email` (display) in sync: prefer work_email, fallback to personal_email
CREATE OR REPLACE FUNCTION public.sync_employee_contact_display_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.email := COALESCE(NULLIF(btrim(NEW.work_email), ''), NULLIF(btrim(NEW.personal_email), ''), NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_contact_display_email ON public.employee_contacts;
CREATE TRIGGER trg_sync_employee_contact_display_email
BEFORE INSERT OR UPDATE OF work_email, personal_email ON public.employee_contacts
FOR EACH ROW
EXECUTE FUNCTION public.sync_employee_contact_display_email();