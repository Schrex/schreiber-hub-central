-- Unapplied candidate. No existing records, trigger states or grants are changed.
-- Identical templates collapse. Conflicting payloads reject instead of discarding data.
CREATE OR REPLACE FUNCTION public.seed_job_contact_slots(_job_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Serialize callers for one job. This does not police direct job_contacts inserts.
  PERFORM 1 FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot seed contacts for missing job' USING ERRCODE = '23503';
  END IF;

  -- Keep validation and insertion on a stable template set until commit.
  LOCK TABLE public.job_contact_template_slots IN SHARE MODE;

  IF EXISTS (
    SELECT 1 FROM public.job_contact_template_slots s
    WHERE s.is_active
    GROUP BY s.category, s.role_label, COALESCE(s.material, '')
    HAVING count(DISTINCT (COALESCE(s.default_name, ''), s.sort_order)) > 1
  ) THEN
    RAISE EXCEPTION 'Conflicting active job contact templates require review'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.job_contacts
    (job_id, name, category, role_label, material, sort_order, is_template_slot)
  SELECT _job_id, s.default_name, s.category, s.role_label, s.material, s.sort_order, true
  FROM (
    SELECT DISTINCT ON (category, role_label, COALESCE(material, ''))
      category, role_label, material, COALESCE(default_name, '') AS default_name, sort_order
    FROM public.job_contact_template_slots
    WHERE is_active
    -- NULL/empty material are equivalent; deterministically retain NULL if both exist.
    ORDER BY category, role_label, COALESCE(material, ''), material NULLS FIRST, id
  ) s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.job_contacts c
    WHERE c.job_id = _job_id AND c.is_template_slot
      AND c.category = s.category AND c.role_label = s.role_label
      AND COALESCE(c.material, '') = COALESCE(s.material, '')
  );
END;
$$;
