
-- Allow users to delete their own notifications
CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Allow service role + definer functions to insert (definer bypasses RLS, but add explicit policy for service_role too)
CREATE POLICY "Service role manages notifications"
  ON public.notifications FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Helper functions
CREATE OR REPLACE FUNCTION public.notify_role(
  _role app_role, _kind text, _title text, _body text, _link text, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, link_url, metadata)
  SELECT ur.user_id, _kind, _title, _body, _link, COALESCE(_metadata, '{}'::jsonb)
  FROM public.user_roles ur WHERE ur.role = _role;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _kind text, _title text, _body text, _link text, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, kind, title, body, link_url, metadata)
  VALUES (_user_id, _kind, _title, _body, _link, COALESCE(_metadata, '{}'::jsonb));
END; $$;

-- Truck requests
CREATE OR REPLACE FUNCTION public.notify_truck_request_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job_name text;
BEGIN
  SELECT j.name INTO v_job_name FROM public.jobs j WHERE j.id = NEW.job_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_role('office'::app_role, 'truck_request_new', 'New truck request',
      COALESCE(NEW.requester_name,'Someone') || ' requested a truck for ' || COALESCE(v_job_name,'a job') || ' on ' || to_char(NEW.requested_date,'Mon DD'),
      '/dispatch', jsonb_build_object('truck_request_id', NEW.id));
    PERFORM public.notify_role('admin'::app_role, 'truck_request_new', 'New truck request',
      COALESCE(NEW.requester_name,'Someone') || ' requested a truck for ' || COALESCE(v_job_name,'a job') || ' on ' || to_char(NEW.requested_date,'Mon DD'),
      '/dispatch', jsonb_build_object('truck_request_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status::text IN ('approved','denied') THEN
    PERFORM public.notify_user(NEW.requester_id, 'truck_request_decision',
      'Truck request ' || NEW.status::text,
      'Your truck request for ' || COALESCE(v_job_name,'a job') || ' on ' || to_char(NEW.requested_date,'Mon DD') || ' was ' || NEW.status::text || '.',
      '/dispatch', jsonb_build_object('truck_request_id', NEW.id, 'status', NEW.status::text));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_truck_request AFTER INSERT OR UPDATE ON public.truck_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_truck_request_changes();

-- Time off
CREATE OR REPLACE FUNCTION public.notify_time_off_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_role('office'::app_role, 'time_off_new', 'New time off request',
      COALESCE(NEW.requester_name,'Someone') || ' requested ' || NEW.type::text || ' from ' || to_char(NEW.start_date,'Mon DD') || ' to ' || to_char(NEW.end_date,'Mon DD'),
      '/time-off', jsonb_build_object('request_id', NEW.id));
    PERFORM public.notify_role('admin'::app_role, 'time_off_new', 'New time off request',
      COALESCE(NEW.requester_name,'Someone') || ' requested ' || NEW.type::text || ' from ' || to_char(NEW.start_date,'Mon DD') || ' to ' || to_char(NEW.end_date,'Mon DD'),
      '/time-off', jsonb_build_object('request_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status::text IN ('approved','denied') THEN
    PERFORM public.notify_user(NEW.user_id, 'time_off_decision',
      'Time off ' || NEW.status::text,
      'Your ' || NEW.type::text || ' request from ' || to_char(NEW.start_date,'Mon DD') || ' to ' || to_char(NEW.end_date,'Mon DD') || ' was ' || NEW.status::text || '.',
      '/time-off', jsonb_build_object('request_id', NEW.id, 'status', NEW.status::text));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_time_off AFTER INSERT OR UPDATE ON public.time_off_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_time_off_changes();

-- Clothing
CREATE OR REPLACE FUNCTION public.notify_clothing_order_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT display_name INTO v_name FROM public.profiles WHERE user_id = NEW.user_id;
    PERFORM public.notify_role('office'::app_role, 'apparel_new', 'New apparel order',
      COALESCE(v_name,'Someone') || ' ordered ' || NEW.quantity || '× ' || NEW.item_name || ' (' || NEW.size || ', ' || NEW.color || ')',
      '/apparel', jsonb_build_object('order_id', NEW.id));
    PERFORM public.notify_role('admin'::app_role, 'apparel_new', 'New apparel order',
      COALESCE(v_name,'Someone') || ' ordered ' || NEW.quantity || '× ' || NEW.item_name || ' (' || NEW.size || ', ' || NEW.color || ')',
      '/apparel', jsonb_build_object('order_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.notify_user(NEW.user_id, 'apparel_status',
      'Apparel order ' || NEW.status::text,
      NEW.item_name || ' (' || NEW.size || ', ' || NEW.color || ') is now ' || NEW.status::text || '.',
      '/apparel', jsonb_build_object('order_id', NEW.id, 'status', NEW.status::text));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_clothing_orders AFTER INSERT OR UPDATE ON public.clothing_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_clothing_order_changes();

-- Equipment rentals
CREATE OR REPLACE FUNCTION public.notify_equipment_rental_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT display_name INTO v_name FROM public.profiles WHERE user_id = NEW.user_id;
    PERFORM public.notify_role('office'::app_role, 'rental_new', 'New equipment rental request',
      COALESCE(v_name,'Someone') || ' requested ' || NEW.equipment_name || ' from ' || to_char(NEW.start_date,'Mon DD') || ' to ' || to_char(NEW.end_date,'Mon DD'),
      '/equipment-rental', jsonb_build_object('rental_id', NEW.id));
    PERFORM public.notify_role('admin'::app_role, 'rental_new', 'New equipment rental request',
      COALESCE(v_name,'Someone') || ' requested ' || NEW.equipment_name || ' from ' || to_char(NEW.start_date,'Mon DD') || ' to ' || to_char(NEW.end_date,'Mon DD'),
      '/equipment-rental', jsonb_build_object('rental_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.notify_user(NEW.user_id, 'rental_status',
      'Equipment rental ' || NEW.status::text,
      NEW.equipment_name || ' is now ' || NEW.status::text || '.',
      '/equipment-rental', jsonb_build_object('rental_id', NEW.id, 'status', NEW.status::text));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_equipment_rentals AFTER INSERT OR UPDATE ON public.equipment_rentals
FOR EACH ROW EXECUTE FUNCTION public.notify_equipment_rental_changes();

-- Schedule assignments
CREATE OR REPLACE FUNCTION public.notify_schedule_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job_name text;
BEGIN
  SELECT j.name INTO v_job_name FROM public.jobs j WHERE j.id = NEW.job_id;
  PERFORM public.notify_user(NEW.user_id, 'schedule_assigned',
    'You''re scheduled',
    'Assigned to ' || COALESCE(v_job_name,'a job') || ' on ' || to_char(NEW.assignment_date,'Mon DD'),
    '/schedule', jsonb_build_object('assignment_id', NEW.id, 'job_id', NEW.job_id));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_schedule_assignment AFTER INSERT ON public.schedule_assignments
FOR EACH ROW EXECUTE FUNCTION public.notify_schedule_assignment();

-- Safety talk attendees
CREATE OR REPLACE FUNCTION public.notify_safety_talk_attendee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_link text;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  v_link := CASE WHEN NEW.access_token IS NOT NULL THEN '/safety/take/' || NEW.access_token ELSE '/safety' END;
  PERFORM public.notify_user(NEW.user_id, 'safety_talk_assigned',
    'Safety talk to complete',
    'You''ve been assigned a safety toolbox talk. Tap to take it.',
    v_link, jsonb_build_object('attendee_id', NEW.id));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_safety_talk_attendee AFTER INSERT ON public.toolbox_talk_attendees
FOR EACH ROW EXECUTE FUNCTION public.notify_safety_talk_attendee();
