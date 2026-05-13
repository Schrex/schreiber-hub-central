DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='safety_inspections' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.safety_inspections', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Office/admin or requester can view safety inspections"
ON public.safety_inspections FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'office'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR requested_by = auth.uid()
);