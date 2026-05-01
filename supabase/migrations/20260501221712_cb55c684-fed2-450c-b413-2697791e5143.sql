-- Fix contacts stored as "Last, First [MI]" — flip to "First Last", extract middle initial
-- Temporarily drop unique index in case of transient collision during update
DROP INDEX IF EXISTS public.employee_contacts_name_unique;

WITH parsed AS (
  SELECT
    id,
    btrim(split_part(name, ',', 1)) AS new_last,
    btrim(split_part(split_part(name, ',', 2), ' ', 1)) AS new_first_raw,
    -- middle initial: any single letter token after first name in the part after the comma
    NULLIF(upper(substring(btrim(regexp_replace(split_part(name, ',', 2), '^\s*\S+\s*', '')) from '^([A-Za-z])')), '') AS new_mi
  FROM public.employee_contacts
  WHERE name LIKE '%,%'
)
UPDATE public.employee_contacts ec
SET
  first_name = p.new_first_raw,
  last_name = p.new_last,
  middle_initial = COALESCE(p.new_mi, ec.middle_initial),
  name = p.new_first_raw || ' ' || p.new_last
FROM parsed p
WHERE ec.id = p.id;

-- Recreate unique index
CREATE UNIQUE INDEX IF NOT EXISTS employee_contacts_name_unique
ON public.employee_contacts (lower(btrim(name)));