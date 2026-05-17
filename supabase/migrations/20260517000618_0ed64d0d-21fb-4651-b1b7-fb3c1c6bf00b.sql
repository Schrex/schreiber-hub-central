CREATE POLICY "Foreman insert future assignments"
ON public.schedule_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'foreman'::app_role)
  AND assignment_date >= ((now() AT TIME ZONE 'America/New_York'))::date
);

CREATE POLICY "Foreman delete future assignments"
ON public.schedule_assignments
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'foreman'::app_role)
  AND assignment_date >= ((now() AT TIME ZONE 'America/New_York'))::date
);