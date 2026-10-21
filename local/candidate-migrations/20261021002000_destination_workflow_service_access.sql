-- Destination-only companion for the five deployed truck/safety functions.
-- Apply only after confirming restored ACL gaps and reviewing this allowlist.
-- Requires the email service-access candidate for public schema USAGE.
-- No browser grants, row changes or email activation.
BEGIN;
GRANT SELECT ON public.profiles, public.jobs, public.app_settings,
  public.user_roles, public.accident_reports, public.safety_violations TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.truck_requests TO service_role;
GRANT SELECT, INSERT ON public.dispatch_orders TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.safety_inspections TO service_role;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class s JOIN pg_depend d ON d.objid=s.oid
    WHERE s.relkind='S' AND d.refobjid IN
      ('public.truck_requests'::regclass,'public.dispatch_orders'::regclass,
       'public.safety_inspections'::regclass)
  ) THEN RAISE EXCEPTION 'Unexpected workflow sequence dependency; review before applying'; END IF;
END $$;
COMMIT;
