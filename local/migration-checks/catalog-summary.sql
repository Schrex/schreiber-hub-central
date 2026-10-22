-- Manual read-only evidence aid; not a destination identity guard or full diff.
-- Keep output private. Do not include function bodies, job commands or row values.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

SELECT current_setting('server_version') AS server_version,
       current_setting('transaction_read_only') AS transaction_read_only;

SELECT extname, extversion FROM pg_catalog.pg_extension ORDER BY extname;

SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind,
       c.relrowsecurity, c.relforcerowsecurity
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'auth', 'storage', 'cron', 'pgmq')
  AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
ORDER BY n.nspname, c.relname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_catalog.pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

SELECT n.nspname AS schema_name, c.relname AS table_name,
       t.tgname AS trigger_name, t.tgenabled
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'auth', 'pgmq') AND NOT t.tgisinternal
ORDER BY n.nspname, c.relname, t.tgname;

SELECT pubname, schemaname, tablename
FROM pg_catalog.pg_publication_tables
ORDER BY pubname, schemaname, tablename;

ROLLBACK;
