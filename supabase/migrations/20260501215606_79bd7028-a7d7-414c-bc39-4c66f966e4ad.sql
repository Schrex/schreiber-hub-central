-- Add separated name fields to employee_contacts
ALTER TABLE public.employee_contacts
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS middle_initial text;

-- Backfill first/last from existing name (best-effort split on whitespace)
UPDATE public.employee_contacts
SET
  first_name = COALESCE(first_name, NULLIF(split_part(btrim(name), ' ', 1), '')),
  last_name = COALESCE(
    last_name,
    NULLIF(btrim(regexp_replace(btrim(name), '^\S+\s*', '')), '')
  )
WHERE first_name IS NULL OR last_name IS NULL;

-- Trigger to keep `name` in sync with first/last whenever provided
CREATE OR REPLACE FUNCTION public.sync_employee_contact_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL THEN
    NEW.name := btrim(concat_ws(' ', NULLIF(btrim(NEW.first_name), ''), NULLIF(btrim(NEW.last_name), '')));
  END IF;
  IF NEW.middle_initial IS NOT NULL THEN
    NEW.middle_initial := upper(left(btrim(NEW.middle_initial), 1));
    IF NEW.middle_initial = '' THEN NEW.middle_initial := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_employee_contact_name_trg ON public.employee_contacts;
CREATE TRIGGER sync_employee_contact_name_trg
BEFORE INSERT OR UPDATE ON public.employee_contacts
FOR EACH ROW EXECUTE FUNCTION public.sync_employee_contact_name();