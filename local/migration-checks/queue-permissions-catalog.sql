-- Metadata only: one result set for CLI/Management API compatibility.
-- Run against the explicitly approved destination before/after queue grants.
-- No business rows or credential values are read. Empty sections remain visible.
WITH
wrapper_definitions AS (
SELECT p.oid::regprocedure AS signature, pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer, p.proconfig AS function_settings,
       pg_get_function_result(p.oid) AS result_type,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('enqueue_email','read_email_batch','delete_email','move_to_dlq')
ORDER BY 1
),
wrapper_execute AS (
SELECT p.oid::regprocedure AS signature, r.role_name,
       has_function_privilege(r.role_name, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) r(role_name)
WHERE n.nspname = 'public'
  AND p.proname IN ('enqueue_email','read_email_batch','delete_email','move_to_dlq')
ORDER BY 1,2
),
schema_permissions AS (
SELECT n.nspname, r.role_name,
       has_schema_privilege(r.role_name,n.oid,'USAGE') AS can_use,
       has_schema_privilege(r.role_name,n.oid,'CREATE') AS can_create
FROM pg_namespace n
CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) r(role_name)
WHERE n.nspname IN ('public','pgmq','pgmq_public') ORDER BY 1,2
),
table_permissions AS (
SELECT c.oid::regclass AS relation, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls, r.role_name,
       has_table_privilege(r.role_name,c.oid,'SELECT') AS can_select,
       has_table_privilege(r.role_name,c.oid,'INSERT') AS can_insert,
       has_table_privilege(r.role_name,c.oid,'UPDATE') AS can_update,
       has_table_privilege(r.role_name,c.oid,'DELETE') AS can_delete,
       has_table_privilege(r.role_name,c.oid,'TRUNCATE') AS can_truncate
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) r(role_name)
WHERE (n.nspname='public' AND c.relname IN
 ('email_send_log','email_send_state','email_unsubscribe_tokens','suppressed_emails'))
 OR (n.nspname='pgmq' AND c.relname IN
 ('q_transactional_emails','q_transactional_emails_dlq'))
ORDER BY 1,4
),
email_policies AS (
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN
 ('email_send_log','email_send_state','email_unsubscribe_tokens','suppressed_emails')
ORDER BY tablename,policyname
),
role_flags AS (
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
WHERE rolname IN ('anon','authenticated','service_role') ORDER BY rolname
),
alternate_queue_entry_points AS (
-- Identify alternate direct queue entry points, not just the four wrappers.
SELECT n.nspname, p.oid::regprocedure AS signature, r.role_name
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
CROSS JOIN (VALUES ('anon'),('authenticated')) r(role_name)
WHERE n.nspname IN ('pgmq','pgmq_public')
  AND has_schema_privilege(r.role_name,n.oid,'USAGE')
  AND has_function_privilege(r.role_name,p.oid,'EXECUTE')
ORDER BY 1,2,3
)
SELECT 'wrapper_definitions' AS section, COALESCE(jsonb_agg(to_jsonb(row)), '[]'::jsonb) AS records FROM wrapper_definitions row
UNION ALL
SELECT 'wrapper_execute' AS section, COALESCE(jsonb_agg(to_jsonb(row)), '[]'::jsonb) AS records FROM wrapper_execute row
UNION ALL
SELECT 'schema_permissions' AS section, COALESCE(jsonb_agg(to_jsonb(row)), '[]'::jsonb) AS records FROM schema_permissions row
UNION ALL
SELECT 'table_permissions' AS section, COALESCE(jsonb_agg(to_jsonb(row)), '[]'::jsonb) AS records FROM table_permissions row
UNION ALL
SELECT 'email_policies' AS section, COALESCE(jsonb_agg(to_jsonb(row)), '[]'::jsonb) AS records FROM email_policies row
UNION ALL
SELECT 'role_flags' AS section, COALESCE(jsonb_agg(to_jsonb(row)), '[]'::jsonb) AS records FROM role_flags row
UNION ALL
SELECT 'alternate_queue_entry_points' AS section, COALESCE(jsonb_agg(to_jsonb(row)), '[]'::jsonb) AS records FROM alternate_queue_entry_points row
ORDER BY section;
