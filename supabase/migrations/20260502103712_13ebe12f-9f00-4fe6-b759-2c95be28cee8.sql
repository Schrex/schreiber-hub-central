ALTER TABLE public.jobs ADD COLUMN foreman_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_foreman_id ON public.jobs(foreman_id);