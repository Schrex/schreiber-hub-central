
ALTER TABLE public.job_submittals
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS ai_categorized boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_job_submittals_category ON public.job_submittals(job_id, category);

ALTER TABLE public.job_permits
  ADD COLUMN IF NOT EXISTS ai_categorized boolean NOT NULL DEFAULT false;
