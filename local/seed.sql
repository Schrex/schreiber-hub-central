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

-- BEGIN lookahead seed
-- Synthetic Cobblestone (J2607) published Mon–Fri grid for the week of 2026-11-09.
-- Leaf tasks that fall in Nov 9–27 only. Parked placeholders are omitted.
-- Built from e2e/fixtures/cobblestone-tasks.csv. No cost, rate, price, or billing figures.
DO $$
DECLARE
  admin_id uuid;
  job_id uuid := '26070000-0000-4000-8000-000000000607';
  plan_id uuid := '26070000-0000-4000-8000-000000000901';
  task_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@example.test';

  INSERT INTO public.jobs (
    id, job_number, name, status, start_date, end_date, lookahead_grid_enabled, created_by
  ) VALUES (
    job_id,
    'J2607',
    'Cobblestone Place / Van Epps',
    'active',
    '2026-10-23',
    '2026-12-18',
    true,
    admin_id
  );

  INSERT INTO public.lookahead_plans (
    id, job_id, week_start, weeks, status, source, source_filename,
    published_at, published_by, created_by, updated_by
  ) VALUES (
    plan_id,
    job_id,
    '2026-11-09',
    3,
    'published',
    'seed',
    'cobblestone-tasks.csv',
    '2026-11-05 15:00:00+00',
    admin_id,
    admin_id,
    admin_id
  );

  INSERT INTO public.lookahead_plan_holidays (plan_id, holiday_date, label) VALUES
    (plan_id, '2026-11-26', 'Thanksgiving'),
    (plan_id, '2026-11-27', 'Thanksgiving');

  INSERT INTO public.lookahead_tasks (
    plan_id, name, group_name, contractor_type, contractor_name, sort_order,
    mpp_unique_id, mpp_wbs, outline_number, pct_complete
  ) VALUES (
    plan_id, 'Strip Topsoil', 'Grading/Dirt work', 'schreiber', 'Schreiber', 1,
    11, '2.1', '2.1', 50
  ) RETURNING id INTO task_id;
  INSERT INTO public.lookahead_task_days (task_id, work_date) VALUES
    (task_id, '2026-11-09');

  INSERT INTO public.lookahead_tasks (
    plan_id, name, group_name, contractor_type, contractor_name, sort_order,
    mpp_unique_id, mpp_wbs, outline_number, pct_complete
  ) VALUES (
    plan_id, 'Cut to export', 'Grading/Dirt work', 'schreiber', 'Schreiber', 2,
    12, '2.2', '2.2', 25
  ) RETURNING id INTO task_id;
  INSERT INTO public.lookahead_task_days (task_id, work_date) VALUES
    (task_id, '2026-11-10'),
    (task_id, '2026-11-11'),
    (task_id, '2026-11-12'),
    (task_id, '2026-11-13'),
    (task_id, '2026-11-16');

  INSERT INTO public.lookahead_tasks (
    plan_id, name, group_name, contractor_type, contractor_name, sort_order,
    mpp_unique_id, mpp_wbs, outline_number, pct_complete
  ) VALUES (
    plan_id, 'Cut to fill', 'Grading/Dirt work', 'schreiber', 'Schreiber', 3,
    13, '2.3', '2.3', 25
  ) RETURNING id INTO task_id;
  INSERT INTO public.lookahead_task_days (task_id, work_date) VALUES
    (task_id, '2026-11-16'),
    (task_id, '2026-11-17'),
    (task_id, '2026-11-18');

  INSERT INTO public.lookahead_tasks (
    plan_id, name, group_name, contractor_type, contractor_name, sort_order,
    mpp_unique_id, mpp_wbs, outline_number, pct_complete
  ) VALUES (
    plan_id, 'Tap sleeve w/valve', 'Water', 'schreiber', 'Schreiber', 4,
    27, '3.1', '3.1', 0
  ) RETURNING id INTO task_id;
  INSERT INTO public.lookahead_task_days (task_id, work_date) VALUES
    (task_id, '2026-11-18'),
    (task_id, '2026-11-19');

  INSERT INTO public.lookahead_tasks (
    plan_id, name, group_name, contractor_type, contractor_name, sort_order,
    mpp_unique_id, mpp_wbs, outline_number, pct_complete
  ) VALUES (
    plan_id, 'Sample Tap', 'Water', 'schreiber', 'Schreiber', 5,
    28, '3.2', '3.2', 0
  ) RETURNING id INTO task_id;
  INSERT INTO public.lookahead_task_days (task_id, work_date) VALUES
    (task_id, '2026-11-19');

  INSERT INTO public.lookahead_tasks (
    plan_id, name, group_name, contractor_type, contractor_name, sort_order,
    mpp_unique_id, mpp_wbs, outline_number, pct_complete
  ) VALUES (
    plan_id, 'Hot Box', 'Water', 'schreiber', 'Schreiber', 6,
    29, '3.3', '3.3', 0
  ) RETURNING id INTO task_id;
  INSERT INTO public.lookahead_task_days (task_id, work_date) VALUES
    (task_id, '2026-11-20'),
    (task_id, '2026-11-23'),
    (task_id, '2026-11-24'),
    (task_id, '2026-11-25');
END $$;
-- END lookahead seed
