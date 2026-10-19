-- Manual destination-only aid AFTER an authorized restore and isolation review.
-- Missing relations must stop the client, not be treated as zero.
-- No source access or application routines; counts do not prove full fidelity.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

SELECT 'auth.users' AS relation_name, count(*) AS row_count FROM auth.users
UNION ALL SELECT 'auth.identities', count(*) FROM auth.identities
UNION ALL SELECT 'public.profiles', count(*) FROM public.profiles
UNION ALL SELECT 'public.user_roles', count(*) FROM public.user_roles
UNION ALL SELECT 'public.pay_audit_log', count(*) FROM public.pay_audit_log
UNION ALL SELECT 'public.celebration_log', count(*) FROM public.celebration_log
UNION ALL SELECT 'public.email_send_log', count(*) FROM public.email_send_log
UNION ALL SELECT 'public.email_send_state', count(*) FROM public.email_send_state
UNION ALL SELECT 'public.suppressed_emails', count(*) FROM public.suppressed_emails
UNION ALL SELECT 'public.email_unsubscribe_tokens', count(*) FROM public.email_unsubscribe_tokens
UNION ALL SELECT 'storage.buckets', count(*) FROM storage.buckets
UNION ALL SELECT 'storage.objects', count(*) FROM storage.objects;

SELECT 'identity_without_user' AS check_name, count(*) AS orphan_count
FROM auth.identities i LEFT JOIN auth.users u ON u.id = i.user_id WHERE u.id IS NULL
UNION ALL
SELECT 'profile_without_user', count(*)
FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.user_id WHERE u.id IS NULL
UNION ALL
SELECT 'role_without_user', count(*)
FROM public.user_roles r LEFT JOIN auth.users u ON u.id = r.user_id WHERE u.id IS NULL;

-- Both must be exactly zero, but these alone do not prove side-effect isolation.
SELECT count(*) AS destination_scheduler_history_rows FROM cron.job_run_details;
SELECT count(*) AS active_cron_jobs FROM cron.job WHERE active;

ROLLBACK;
