ALTER TABLE public.employee_positions
  ADD COLUMN IF NOT EXISTS is_salaried boolean NOT NULL DEFAULT false;