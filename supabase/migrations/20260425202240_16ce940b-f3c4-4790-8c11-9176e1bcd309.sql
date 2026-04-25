-- 1. Add contact_id on profiles to mirror converted_user_id on employee_contacts
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.employee_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_contact_id ON public.profiles(contact_id);
CREATE INDEX IF NOT EXISTS idx_employee_contacts_converted_user_id ON public.employee_contacts(converted_user_id);
CREATE INDEX IF NOT EXISTS idx_employee_contacts_email_lower ON public.employee_contacts(lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles(lower(email));

-- 2. Backfill: link existing profiles <-> contacts by matching email (case-insensitive)
WITH matches AS (
  SELECT DISTINCT ON (p.user_id)
    p.user_id, p.id AS profile_id, ec.id AS contact_id
  FROM public.profiles p
  JOIN public.employee_contacts ec
    ON lower(ec.email) = lower(p.email)
  WHERE p.email IS NOT NULL
    AND ec.email IS NOT NULL
    AND p.contact_id IS NULL
    AND ec.converted_user_id IS NULL
  ORDER BY p.user_id, ec.created_at ASC
)
UPDATE public.profiles p
SET contact_id = m.contact_id
FROM matches m
WHERE p.user_id = m.user_id;

UPDATE public.employee_contacts ec
SET converted_user_id = p.user_id,
    is_active = true
FROM public.profiles p
WHERE p.contact_id = ec.id
  AND ec.converted_user_id IS NULL;

-- 3. Backfill: create contact rows for any logins that still have no linked contact
INSERT INTO public.employee_contacts (name, email, converted_user_id, is_active)
SELECT
  COALESCE(p.display_name, split_part(p.email, '@', 1), 'Employee'),
  p.email,
  p.user_id,
  p.is_active
FROM public.profiles p
WHERE p.contact_id IS NULL;

UPDATE public.profiles p
SET contact_id = ec.id
FROM public.employee_contacts ec
WHERE ec.converted_user_id = p.user_id
  AND p.contact_id IS NULL;

-- 4. Sync trigger: profiles -> employee_contacts
CREATE OR REPLACE FUNCTION public.sync_profile_to_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE public.employee_contacts
    SET name = COALESCE(NEW.display_name, name),
        email = COALESCE(NEW.email, email),
        is_active = NEW.is_active,
        converted_user_id = NEW.user_id,
        updated_at = now()
    WHERE id = NEW.contact_id
      AND (
        name IS DISTINCT FROM COALESCE(NEW.display_name, name)
        OR email IS DISTINCT FROM COALESCE(NEW.email, email)
        OR is_active IS DISTINCT FROM NEW.is_active
        OR converted_user_id IS DISTINCT FROM NEW.user_id
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_contact ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_contact
AFTER UPDATE OF display_name, email, is_active, contact_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_contact();

-- 5. Sync trigger: employee_contacts -> profiles
CREATE OR REPLACE FUNCTION public.sync_contact_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.converted_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET display_name = COALESCE(NEW.name, display_name),
        email = COALESCE(NEW.email, email),
        contact_id = NEW.id,
        updated_at = now()
    WHERE user_id = NEW.converted_user_id
      AND (
        display_name IS DISTINCT FROM COALESCE(NEW.name, display_name)
        OR email IS DISTINCT FROM COALESCE(NEW.email, email)
        OR contact_id IS DISTINCT FROM NEW.id
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contact_to_profile ON public.employee_contacts;
CREATE TRIGGER trg_sync_contact_to_profile
AFTER UPDATE OF name, email, converted_user_id ON public.employee_contacts
FOR EACH ROW EXECUTE FUNCTION public.sync_contact_to_profile();

-- 6. Update handle_new_user: link to existing contact by email or create a new one
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
  v_contact_id uuid;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Try to find an existing unlinked contact with the same email
  SELECT id INTO v_contact_id
  FROM public.employee_contacts
  WHERE lower(email) = lower(NEW.email)
    AND converted_user_id IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  -- If none found, create one
  IF v_contact_id IS NULL THEN
    INSERT INTO public.employee_contacts (name, email, converted_user_id, is_active)
    VALUES (v_display_name, NEW.email, NEW.id, true)
    RETURNING id INTO v_contact_id;
  ELSE
    UPDATE public.employee_contacts
    SET converted_user_id = NEW.id,
        is_active = true,
        updated_at = now()
    WHERE id = v_contact_id;
  END IF;

  INSERT INTO public.profiles (user_id, email, display_name, contact_id)
  VALUES (NEW.id, NEW.email, v_display_name, v_contact_id);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');

  RETURN NEW;
END;
$$;

-- 7. Make sure the trigger on auth.users actually exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();