-- Replace write policies to also require date >= today (America/New_York)
DROP POLICY IF EXISTS "Office admin insert assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Office admin update assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Office admin delete assignments" ON public.schedule_assignments;

CREATE POLICY "Office admin insert future assignments"
  ON public.schedule_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND assignment_date >= ((now() AT TIME ZONE 'America/New_York')::date)
  );

CREATE POLICY "Office admin update future assignments"
  ON public.schedule_assignments FOR UPDATE
  TO authenticated
  USING (
    (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND assignment_date >= ((now() AT TIME ZONE 'America/New_York')::date)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND assignment_date >= ((now() AT TIME ZONE 'America/New_York')::date)
  );

CREATE POLICY "Office admin delete future assignments"
  ON public.schedule_assignments FOR DELETE
  TO authenticated
  USING (
    (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND assignment_date >= ((now() AT TIME ZONE 'America/New_York')::date)
  );