-- Read-only, aggregate-only. Never returns addresses, names, payloads or tokens.
-- Run centrally against the explicitly selected destination, with delivery off.
BEGIN READ ONLY;
WITH target_users AS (
  SELECT 'safety_reports' AS workflow, user_id FROM public.user_roles WHERE role IN ('office','admin')
  UNION
  SELECT 'time_off_approval', user_id FROM public.user_roles WHERE role IN ('admin','foreman')
  UNION
  SELECT 'time_off_approval', ep.user_id FROM public.employee_positions ep
    JOIN public.positions p ON p.id=ep.position_id
    WHERE p.title='Equipment Manager' AND ep.end_date IS NULL
), workflows(workflow) AS (VALUES ('safety_reports'),('time_off_approval')), fanout AS (
SELECT w.workflow, count(DISTINCT t.user_id) AS target_users,
  count(DISTINCT p.user_id) FILTER (WHERE coalesce(p.email,'') <> '') AS profiles_with_email,
  count(DISTINCT lower(trim(p.email))) FILTER (WHERE coalesce(p.email,'') <> '') AS normalized_unique_recipients
FROM workflows w LEFT JOIN target_users t USING(workflow)
LEFT JOIN public.profiles p ON p.user_id=t.user_id GROUP BY w.workflow
),

keys(key) AS (VALUES ('office_dispatch_email'),('york_safety_email')), settings AS (
SELECT k.key, count(s.key) AS setting_rows,
 count(*) FILTER (WHERE coalesce(nullif(s.value #>> '{}',''),nullif(s.value->>'email','')) IS NOT NULL AND
   (jsonb_typeof(s.value)='string' OR (jsonb_typeof(s.value)='object' AND coalesce(s.value->>'email','')<>''))) AS usable_setting_rows
FROM keys k LEFT JOIN public.app_settings s USING(key) GROUP BY k.key
), queues AS (

SELECT 'transactional_emails' AS queue, count(*) AS queued,
 count(*) FILTER (WHERE read_ct>0) AS previously_claimed,
 count(DISTINCT lower(trim(message->>'to'))) AS unique_recipient_values,
 count(*) FILTER (WHERE jsonb_typeof(message->'to') IS DISTINCT FROM 'string' OR coalesce(trim(message->>'to'),'')='') AS malformed_recipients
FROM pgmq.q_transactional_emails
UNION ALL
SELECT 'transactional_emails_dlq', count(*), count(*) FILTER (WHERE read_ct>0),
 count(DISTINCT lower(trim(message->>'to'))),
 count(*) FILTER (WHERE jsonb_typeof(message->'to') IS DISTINCT FROM 'string' OR coalesce(trim(message->>'to'),'')='')
FROM pgmq.q_transactional_emails_dlq
)
SELECT jsonb_build_object(
  'fanout', (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.workflow) FROM fanout f),
  'settings', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.key) FROM settings s),
  'queues', (SELECT jsonb_agg(to_jsonb(q) ORDER BY q.queue) FROM queues q)
) AS recipient_audit;
COMMIT;
