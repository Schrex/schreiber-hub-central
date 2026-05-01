CREATE TYPE public.truck_request_status AS ENUM ('pending', 'approved', 'declined', 'cancelled');

CREATE TABLE public.truck_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  requested_date date NOT NULL,
  start_time time,
  material text,
  pickup_location text,
  dump_location text,
  load_quantity numeric,
  requester_id uuid,
  requester_name text,
  requester_notes text,
  status public.truck_request_status NOT NULL DEFAULT 'pending',
  assigned_truck_number text,
  assigned_driver_user_id uuid,
  assigned_driver_name text,
  decision_notes text,
  decided_by uuid,
  decided_at timestamptz,
  dispatch_order_id uuid REFERENCES public.dispatch_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX truck_requests_job_id_idx ON public.truck_requests(job_id);
CREATE INDEX truck_requests_status_idx ON public.truck_requests(status);
CREATE INDEX truck_requests_requested_date_idx ON public.truck_requests(requested_date);

ALTER TABLE public.truck_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view truck requests"
  ON public.truck_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Foreman office admin insert truck requests"
  ON public.truck_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'foreman'::app_role)
    OR has_role(auth.uid(), 'office'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Requester updates own pending request"
  ON public.truck_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id AND status = 'pending')
  WITH CHECK (auth.uid() = requester_id AND status IN ('pending', 'cancelled'));

CREATE POLICY "Office admin update any truck request"
  ON public.truck_requests FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin delete truck requests"
  ON public.truck_requests FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_truck_requests_updated_at
  BEFORE UPDATE ON public.truck_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.truck_requests;