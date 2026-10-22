-- Read-only catalog inspection; no business rows or credential values.
SELECT json_build_object(
 'role',current_user,
 'tables',(SELECT json_agg(json_build_object(
   'schema',n.nspname,'owner',pg_get_userbyid(c.relowner),'count',c.total,
   'owner_privileges',pg_has_role(current_user,c.relowner,'USAGE')
 )) FROM (SELECT relnamespace,relowner,count(*) AS total FROM pg_class
   WHERE relkind='r' AND (relnamespace='public'::regnamespace OR oid='auth.users'::regclass)
   GROUP BY relnamespace,relowner) c JOIN pg_namespace n ON n.oid=c.relnamespace),
 'auth_trigger_privilege',has_table_privilege(current_user,'auth.users','TRIGGER'),
 'auth_function_execute',has_function_privilege(current_user,'public.handle_new_user()','EXECUTE'),
 'auth_owner_set_role',pg_has_role(current_user,(SELECT relowner FROM pg_class WHERE oid='auth.users'::regclass),'SET'),
 'business_triggers',(SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE NOT t.tgisinternal AND (c.relnamespace='public'::regnamespace OR c.oid='auth.users'::regclass)),
 'outbound_extensions',(SELECT count(*) FROM pg_extension WHERE extname IN ('pg_cron','pg_net','pgmq'))
);
