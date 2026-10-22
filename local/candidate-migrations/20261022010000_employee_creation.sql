-- UNAPPLIED release candidate. Only the create-employee service may call these RPCs.
-- No trigger activation, historical migration changes, or broad table ACL grants.
BEGIN;
CREATE OR REPLACE FUNCTION public.prepare_employee_creation(caller_id uuid, details jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  contact_id uuid := (details->>'creationContactId')::uuid;
  contact_email text := nullif(lower(btrim(details->>'email')), '');
  login_email text := nullif(lower(btrim(details->>'loginEmail')), '');
  wants_login boolean := coalesce((details->>'createLogin')::boolean, false);
  is_admin boolean := public.has_role(caller_id, 'admin');
  email_key text;
BEGIN
  IF NOT (is_admin OR public.has_role(caller_id, 'office') OR public.has_role(caller_id, 'foreman'))
    THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
  IF (wants_login OR nullif(details->>'positionId','') IS NOT NULL) AND NOT is_admin
    THEN RAISE EXCEPTION 'Only admins can create logins or assign positions' USING ERRCODE='42501'; END IF;
  IF nullif(btrim(details->>'name'), '') IS NULL THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF wants_login AND login_email IS NULL THEN RAISE EXCEPTION 'Login email is required'; END IF;
  IF coalesce(details->>'role','employee') NOT IN ('employee','foreman','office','admin')
    THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF nullif(details->>'positionId','') IS NOT NULL THEN
    IF NOT wants_login THEN RAISE EXCEPTION 'A login is required to assign a position'; END IF;
    IF details->>'payRate' IS NULL OR (details->>'payRate')::numeric < 0
       OR (details->>'payRate')::numeric::text IN ('NaN','Infinity','-Infinity')
      THEN RAISE EXCEPTION 'Valid pay rate is required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.positions WHERE id=(details->>'positionId')::uuid AND is_active)
      THEN RAISE EXCEPTION 'Choose an active position'; END IF;
  END IF;
  -- Serialize endpoint requests sharing either email, including different login/contact emails.
  FOR email_key IN SELECT DISTINCT e FROM unnest(ARRAY[contact_email, CASE WHEN wants_login THEN login_email END]) e WHERE e IS NOT NULL ORDER BY e LOOP
    IF email_key !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid email'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(email_key, 22102026));
    IF EXISTS (SELECT 1 FROM public.employee_contacts WHERE email_key IN (lower(email), lower(work_email), lower(personal_email)))
       OR EXISTS (SELECT 1 FROM auth.users WHERE lower(email)=email_key)
      THEN RAISE EXCEPTION 'An employee or login with this email already exists'; END IF;
  END LOOP;
  INSERT INTO public.employee_contacts(id,name,first_name,last_name,middle_initial,email,work_email,personal_email,phone,address,department,notes,date_of_birth,hire_date,created_by,is_active)
  VALUES(contact_id,btrim(details->>'name'),nullif(btrim(details->>'first_name'),''),nullif(btrim(details->>'last_name'),''),
    nullif(upper(left(btrim(details->>'middle_initial'),1)),''),CASE WHEN wants_login THEN login_email ELSE contact_email END,
    CASE WHEN wants_login THEN login_email END,contact_email,
    nullif(btrim(details->>'phone'),''),nullif(btrim(details->>'address'),''),nullif(btrim(details->>'department'),''),
    nullif(btrim(details->>'notes'),''),nullif(details->>'date_of_birth','')::date,nullif(details->>'hire_date','')::date,caller_id,true);
  RETURN contact_id;
END; $$;

CREATE OR REPLACE FUNCTION public.finish_employee_creation(caller_id uuid, contact_id uuid, new_user_id uuid, details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE contact public.employee_contacts; chosen_role public.app_role := coalesce(details->>'role','employee')::public.app_role;
BEGIN
  IF NOT public.has_role(caller_id,'admin') THEN RAISE EXCEPTION 'Only admins can create logins' USING ERRCODE='42501'; END IF;
  SELECT * INTO STRICT contact FROM public.employee_contacts WHERE id=contact_id AND created_by=caller_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=new_user_id AND raw_app_meta_data->>'employee_creation_contact_id'=contact_id::text)
    THEN RAISE EXCEPTION 'Login does not belong to this creation request'; END IF;
  IF contact.converted_user_id IS NOT NULL AND contact.converted_user_id<>new_user_id
    THEN RAISE EXCEPTION 'Contact already linked'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id=new_user_id AND profiles.contact_id IS NOT NULL AND profiles.contact_id<>finish_employee_creation.contact_id)
    THEN RAISE EXCEPTION 'Login linked to another contact'; END IF;
  -- Explicit writes work with the signup trigger both enabled and absent/disabled.
  INSERT INTO public.profiles(user_id,email,display_name,contact_id,is_active)
  VALUES(new_user_id,contact.email,contact.name,contact_id,true)
  ON CONFLICT (user_id) DO UPDATE SET contact_id=excluded.contact_id,display_name=excluded.display_name,email=excluded.email,is_active=true;
  DELETE FROM public.user_roles WHERE user_id=new_user_id;
  INSERT INTO public.user_roles(user_id,role) VALUES(new_user_id,chosen_role);
  UPDATE public.employee_contacts SET converted_user_id=new_user_id,is_active=true,work_email=null,
    personal_email=coalesce(nullif(lower(btrim(details->>'email')),''),nullif(lower(btrim(details->>'loginEmail')),'')),
    email=coalesce(nullif(lower(btrim(details->>'email')),''),nullif(lower(btrim(details->>'loginEmail')),'')) WHERE id=contact_id;
  -- Explicit profile sync also covers environments where business triggers are disabled.
  UPDATE public.profiles SET email=(SELECT email FROM public.employee_contacts WHERE id=finish_employee_creation.contact_id) WHERE user_id=new_user_id;
  IF nullif(details->>'positionId','') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.positions WHERE id=(details->>'positionId')::uuid AND is_active)
      THEN RAISE EXCEPTION 'Choose an active position'; END IF;
    INSERT INTO public.employee_positions(user_id,position_id,pay_rate,effective_date,created_by)
    VALUES(new_user_id,(details->>'positionId')::uuid,(details->>'payRate')::numeric,
      coalesce(nullif(details->>'effectiveDate','')::date,(now() AT TIME ZONE 'America/New_York')::date),caller_id);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_employee_creation(caller_id uuid, contact_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE linked_user uuid;
BEGIN
  SELECT converted_user_id INTO linked_user FROM public.employee_contacts WHERE id=contact_id AND created_by=caller_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserved contact not found'; END IF;
  -- Unknown Auth outcomes must be reconciled, never silently retried or orphaned.
  IF EXISTS (SELECT 1 FROM auth.users WHERE id=linked_user OR raw_app_meta_data->>'employee_creation_contact_id'=contact_id::text)
    THEN RAISE EXCEPTION 'Login still exists; administrator review required'; END IF;
  DELETE FROM public.employee_positions WHERE user_id=linked_user;
  DELETE FROM public.employee_contacts WHERE id=contact_id AND created_by=caller_id;
END; $$;

REVOKE ALL ON FUNCTION public.prepare_employee_creation(uuid,jsonb),public.finish_employee_creation(uuid,uuid,uuid,jsonb),public.cancel_employee_creation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_employee_creation(uuid,jsonb),public.finish_employee_creation(uuid,uuid,uuid,jsonb),public.cancel_employee_creation(uuid,uuid) TO service_role;
COMMIT;
