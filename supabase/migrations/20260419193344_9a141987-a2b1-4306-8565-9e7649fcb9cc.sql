-- Create 4 employee accounts with default password '5992Ontario!'
-- The handle_new_user trigger will auto-create profile + employee role

DO $$
DECLARE
  v_brody uuid;
  v_nick uuid;
  v_ed uuid;
  v_scott uuid;
  v_pwd text := crypt('5992Ontario!', gen_salt('bf'));
BEGIN
  -- Brody Wilson (foreman)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'brody@schrex.com', v_pwd, now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('display_name','Brody Wilson'), now(), now(), '', '', '', '')
  RETURNING id INTO v_brody;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_brody, v_brody::text, jsonb_build_object('sub', v_brody::text, 'email', 'brody@schrex.com', 'email_verified', true), 'email', now(), now(), now());

  -- Nick Monachino (foreman)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'nick@schrex.com', v_pwd, now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('display_name','Nick Monachino'), now(), now(), '', '', '', '')
  RETURNING id INTO v_nick;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_nick, v_nick::text, jsonb_build_object('sub', v_nick::text, 'email', 'nick@schrex.com', 'email_verified', true), 'email', now(), now(), now());

  -- Ed Stokes (foreman)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'ed@schrex.com', v_pwd, now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('display_name','Ed Stokes'), now(), now(), '', '', '', '')
  RETURNING id INTO v_ed;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_ed, v_ed::text, jsonb_build_object('sub', v_ed::text, 'email', 'ed@schrex.com', 'email_verified', true), 'email', now(), now(), now());

  -- Scott Schreiber (driver, employee role)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'trucking@schrex.com', v_pwd, now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('display_name','Scott Schreiber'), now(), now(), '', '', '', '')
  RETURNING id INTO v_scott;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_scott, v_scott::text, jsonb_build_object('sub', v_scott::text, 'email', 'trucking@schrex.com', 'email_verified', true), 'email', now(), now(), now());

  -- Promote foremen
  UPDATE public.user_roles SET role = 'foreman' WHERE user_id IN (v_brody, v_nick, v_ed);

  -- Tag Scott as driver
  UPDATE public.profiles SET is_driver = true WHERE user_id = v_scott;
END $$;