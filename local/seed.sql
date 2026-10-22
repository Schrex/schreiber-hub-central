-- LOCAL ONLY. Replaced historical business rows with disposable synthetic data.
-- This file is copied only into .local-backend; never a production migration.
DO $$
DECLARE tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO tables FROM pg_tables WHERE schemaname = 'public';
  IF tables IS NOT NULL THEN
    EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;
TRUNCATE auth.users CASCADE;

DO $$
DECLARE
  entry record;
  uid uuid;
BEGIN
  FOR entry IN SELECT * FROM (VALUES
    ('employee', 'Local Employee'),
    ('other', 'Other Local Employee'),
    ('admin', 'Local Admin')
  ) AS people(handle, display_name)
  LOOP
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      entry.handle || '@example.test', extensions.crypt('LocalOnly-12345!', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', entry.display_name), now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    VALUES (gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', entry.handle || '@example.test', 'email_verified', true),
      'email', now(), now());
    IF entry.handle = 'admin' THEN
      UPDATE public.user_roles SET role = 'admin' WHERE user_id = uid;
    END IF;
  END LOOP;
END $$;
