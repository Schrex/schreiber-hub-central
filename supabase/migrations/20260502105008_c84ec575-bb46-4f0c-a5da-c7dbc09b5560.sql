CREATE POLICY "Foreman update future assignments"
ON public.schedule_assignments
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'foreman'::app_role)
  AND assignment_date >= ((now() AT TIME ZONE 'America/New_York'::text))::date
);