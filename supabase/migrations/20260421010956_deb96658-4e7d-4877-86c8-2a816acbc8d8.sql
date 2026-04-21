
CREATE POLICY "Employees view own assigned position"
  ON public.positions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_positions ep
      WHERE ep.position_id = positions.id
        AND ep.user_id = auth.uid()
    )
  );
