-- Forward fix; deploy separately through the reviewed Cloud release procedure.
-- New requests must start pending and cannot carry fabricated approval metadata.
DROP POLICY "Users insert own time off" ON public.time_off_requests;
CREATE POLICY "Users insert own time off"
ON public.time_off_requests FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id AND status = 'pending'
  AND decided_by IS NULL AND decided_at IS NULL
  AND denial_reason IS NULL AND invites_sent_at IS NULL
);

-- USING applies to the old row; WITH CHECK applies to the proposed row.
-- The old policy implicitly required the new status to remain pending.
DROP POLICY "Users cancel own pending" ON public.time_off_requests;
CREATE POLICY "Users cancel own pending"
ON public.time_off_requests FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- RLS filters rows, not individual fields. A cancellation must not also alter
-- ownership, dates, approval metadata, or other request content.
CREATE FUNCTION public.validate_employee_time_off_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF OLD.user_id IS DISTINCT FROM auth.uid()
       OR OLD.status <> 'pending' OR NEW.status <> 'cancelled'
       OR (to_jsonb(NEW) - 'status' - 'updated_at') IS DISTINCT FROM
          (to_jsonb(OLD) - 'status' - 'updated_at') THEN
      RAISE EXCEPTION 'Employees may only cancel their own pending time-off request'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_employee_time_off_update
BEFORE UPDATE ON public.time_off_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_employee_time_off_update();
