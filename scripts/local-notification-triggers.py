#!/usr/bin/env python3
"""Synthetic notification logic tests, fixed disposable Docker only, always rollback.
Uses temporary event tables and real notification helpers/dependency tables. Not an
RLS/full-table/SMTP test. All public/Auth/queue hooks disabled transactionally first.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ARCHIVE = Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')

def query(sql):
    p = subprocess.run(['docker','exec','-i','supabase_db_schreiber-local','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'],input=sql,text=True,capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr)
    return p.stdout.strip()

def quote(s):
    return "'" + s.replace("'", "''") + "'"

def uid(i):
    return f'79000000-0000-4000-8000-{i:012d}'

parser = argparse.ArgumentParser()
parser.add_argument('--candidate', action='store_true', help='Test unapplied safety-recipient fix inside the rollback transaction')
args = parser.parse_args()
candidate = Path(__file__).resolve().parent.parent/'local/candidate-migrations/20261019233000_safety_notification_recipient_dedup.sql'

source = (ARCHIVE/'inspection/schema.sql').read_text()
artifact = (ARCHIVE/'behavior-review/public-triggers-disabled.sql').read_text()
assert hashlib.sha256(artifact.encode()).hexdigest() == '995142ef62107a6a32d73cc6e723d56704d1e51c338ff1afc948627b276086e8'
bindings = re.findall(r'^CREATE TRIGGER (\w+) AFTER (INSERT(?: OR UPDATE)?) ON public\.(\w+) FOR EACH ROW EXECUTE FUNCTION public\.(notify_\w+)\(\);$',artifact,re.M)
assert len(bindings) == 9
names = [b[3] for b in bindings] + ['notify_user','notify_role']
for name in names:
    definition = re.search(r'CREATE FUNCTION public\.'+name+r'\(.*?\$\$;',source,re.S)[0]
    body = definition.split('AS $$',1)[1].rsplit('$$;',1)[0]
    actual = json.loads(query("SELECT json_build_object('hash',md5(prosrc),'definer',prosecdef,'config',proconfig,'owner',pg_get_userbyid(proowner)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname="+quote(name)+';'))
    assert actual == {'hash':hashlib.md5(body.encode()).hexdigest(),'definer':True,'config':['search_path=public'],'owner':'postgres'}, name

sql = """BEGIN;
SELECT pg_advisory_xact_lock(19761019,99);
SET LOCAL statement_timeout='90s';
CREATE TEMP TABLE original_triggers AS SELECT oid,tgenabled FROM pg_trigger;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT n.nspname,c.relname,t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','pgmq') LOOP
 EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I',r.nspname,r.relname,r.tgname);
 END LOOP;
END $$;
DELETE FROM public.notifications;
DELETE FROM public.user_roles;
DELETE FROM public.employee_positions;
"""
for i,role in [(1,'employee'),(2,'foreman'),(3,'office'),(4,'admin'),(5,'employee'),(6,'employee')]:
    sql += f"INSERT INTO auth.users(id,email) VALUES('{uid(i)}','notification-{i}@example.test');\nINSERT INTO public.profiles(user_id,display_name) VALUES('{uid(i)}','Synthetic {i}');\nINSERT INTO public.user_roles(user_id,role) VALUES('{uid(i)}','{role}');\n"
sql += f"""
INSERT INTO public.employee_contacts(id,name,converted_user_id) VALUES('{uid(102)}','Manager','{uid(2)}');
INSERT INTO public.employee_contacts(id,name,converted_user_id,manager_contact_id) VALUES('{uid(101)}','Employee','{uid(1)}','{uid(102)}');
INSERT INTO public.jobs(id,name,foreman_id) VALUES('{uid(200)}','Synthetic job','{uid(2)}');
INSERT INTO public.positions(id,title,min_pay_rate,max_pay_rate) VALUES('{uid(300)}','President',0,100);
INSERT INTO public.employee_positions(user_id,position_id,pay_rate,effective_date) VALUES('{uid(5)}','{uid(300)}',1,current_date);
INSERT INTO public.employee_positions(user_id,position_id,pay_rate,effective_date,end_date) VALUES('{uid(6)}','{uid(300)}',1,current_date-10,current_date-1);
"""
for trigger,event,table,function in bindings:
    sql += f"""CREATE TEMP TABLE probe_{table}(id uuid DEFAULT '{uid(900)}',user_id uuid DEFAULT '{uid(1)}',requester_id uuid DEFAULT '{uid(1)}',job_id uuid DEFAULT '{uid(200)}',status text DEFAULT 'pending',job_name_snapshot text DEFAULT '',reported_by_name text,incident_type text DEFAULT 'injury',severity text DEFAULT 'minor',quantity int DEFAULT 1,item_name text DEFAULT 'shirt',size text DEFAULT 'M',color text DEFAULT 'blue',equipment_name text DEFAULT 'excavator',start_date date DEFAULT current_date,end_date date DEFAULT current_date,access_token text,employee_contact_id uuid DEFAULT '{uid(101)}',filed_by_name text,employee_name text DEFAULT 'Synthetic employee',disciplinary_action text DEFAULT 'warning',assignment_date date DEFAULT current_date,week_of date DEFAULT current_date,requester_name text,type text DEFAULT 'vacation',requested_date date DEFAULT current_date);
CREATE TRIGGER {trigger} AFTER {event} ON probe_{table} FOR EACH ROW EXECUTE FUNCTION public.{function}();
GRANT SELECT,INSERT,UPDATE,DELETE ON probe_{table} TO authenticated;
"""
checks = 0
source_hash = query("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.notify_safety_violation()'::regprocedure;")

def case(statement, recipients, kind=None, link=None, metadata_key=None):
    global sql,checks
    checks += 1
    expected = ','.join(quote(uid(i))+'::uuid' for i in sorted(recipients))
    expr = 'ARRAY['+expected+']::uuid[]'
    sql += 'DELETE FROM public.notifications;\nSET LOCAL ROLE authenticated;\n'+statement+';\nRESET ROLE;\n'
    sql += f"DO $$ BEGIN IF (SELECT COALESCE(array_agg(user_id ORDER BY user_id),ARRAY[]::uuid[]) FROM public.notifications) IS DISTINCT FROM {expr} THEN RAISE EXCEPTION 'Notification recipients case {checks} mismatch'; END IF;"
    if kind:
        sql += f"IF EXISTS(SELECT 1 FROM public.notifications WHERE kind<>{quote(kind)} OR title IS NULL OR body IS NULL) THEN RAISE EXCEPTION 'Notification payload case {checks} mismatch'; END IF;"
    if link:
        sql += f"IF EXISTS(SELECT 1 FROM public.notifications WHERE link_url<>{quote(link)}) THEN RAISE EXCEPTION 'Notification link case {checks} mismatch'; END IF;"
    if metadata_key:
        sql += f"IF EXISTS(SELECT 1 FROM public.notifications WHERE metadata->>{quote(metadata_key)} IS DISTINCT FROM {quote(uid(900))}) THEN RAISE EXCEPTION 'Notification metadata case {checks} mismatch'; END IF;"
    sql += 'END $$;\n'

if args.candidate:
    # Prove the exported implementation duplicates before changing its body.
    sql += f"INSERT INTO public.user_roles(user_id,role) VALUES('{uid(5)}','admin');\n"
    case('INSERT INTO probe_safety_violations(employee_contact_id) VALUES(NULL)',[4,5,5],'safety_violation')
    sql += f"DELETE FROM public.user_roles WHERE user_id='{uid(5)}' AND role='admin';\n"
    sql += candidate.read_text() + '\n'
    sql += "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.notify_safety_violation()'::regprocedure AND prosecdef AND proconfig=ARRAY['search_path=public'] AND pg_get_userbyid(proowner)='postgres') THEN RAISE EXCEPTION 'Candidate security changed'; END IF; END $$;\n"

for table,kind,statuskind,link,key in [
    ('clothing_orders','apparel_new','apparel_status','/apparel','order_id'),
    ('equipment_rentals','rental_new','rental_status','/equipment-rental','rental_id'),
    ('time_off_requests','time_off_new','time_off_decision','/time-off','request_id'),
    ('truck_requests','truck_request_new','truck_request_decision','/dispatch','truck_request_id')]:
    case(f'INSERT INTO probe_{table} DEFAULT VALUES',[3,4],kind,link,key)
    case(f"UPDATE probe_{table} SET status=status",[])
    case(f"UPDATE probe_{table} SET status='approved'",[1],statuskind,link,key)
    case(f"UPDATE probe_{table} SET status='approved'",[])
    case(f"UPDATE probe_{table} SET status='denied'",[1],statuskind,link,key)
    case(f"UPDATE probe_{table} SET status='cancelled'",[] if table in ['time_off_requests','truck_requests'] else [1])
case('INSERT INTO probe_accident_reports DEFAULT VALUES',[3,4],'accident_report','/safety/reports/'+uid(900),'report_id')
case('INSERT INTO probe_schedule_assignments DEFAULT VALUES',[1],'schedule_assigned','/schedule','assignment_id')
case('INSERT INTO probe_swpppp_reports DEFAULT VALUES',[2,3,4],'swpppp_report','/jobs/'+uid(200),'report_id')
case('INSERT INTO probe_swpppp_reports(job_id) VALUES(NULL)',[3,4],'swpppp_report')
case('INSERT INTO probe_toolbox_talk_attendees(user_id) VALUES(NULL)',[])
case('INSERT INTO probe_toolbox_talk_attendees DEFAULT VALUES',[1],'safety_talk_assigned','/safety','attendee_id')
case("INSERT INTO probe_toolbox_talk_attendees(access_token) VALUES('synthetic-token')",[1],'safety_talk_assigned','/safety/take/synthetic-token','attendee_id')
case('INSERT INTO probe_safety_violations DEFAULT VALUES',[1,2,4,5],'safety_violation','/safety/violations/'+uid(900),'violation_id')
case('INSERT INTO probe_safety_violations(employee_contact_id) VALUES(NULL)',[4,5],'safety_violation')
# INSERT-only bindings must stay quiet on subsequent edits.
for table in ['accident_reports','schedule_assignments','swpppp_reports','toolbox_talk_attendees','safety_violations']:
    case(f"UPDATE probe_{table} SET status='changed'",[])
# Manager/offender identity overlap must not duplicate that recipient.
sql += f"UPDATE public.employee_contacts SET manager_contact_id=id WHERE id='{uid(101)}';\n"
case('INSERT INTO probe_safety_violations DEFAULT VALUES',[1,4,5],'safety_violation')
# Future President assignments are excluded, as are the expired assignment above.
sql += f"INSERT INTO public.employee_positions(user_id,position_id,pay_rate,effective_date) VALUES('{uid(6)}','{uid(300)}',1,current_date+1);\n"
case('INSERT INTO probe_safety_violations(employee_contact_id) VALUES(NULL)',[4,5],'safety_violation')
# Characterize existing duplicate behavior: an active President who is also admin
# receives one message from each loop. This is observed source behavior, not a fix.
sql += f"INSERT INTO public.user_roles(user_id,role) VALUES('{uid(5)}','admin');\n"
case('INSERT INTO probe_safety_violations(employee_contact_id) VALUES(NULL)',[4,5] if args.candidate else [4,5,5],'safety_violation')
if args.candidate:
    # Offender and manager can each also hold President/admin roles: one each.
    sql += f"UPDATE public.employee_contacts SET manager_contact_id='{uid(102)}' WHERE id='{uid(101)}';\n"
    for i in [1,2]:
        sql += f"INSERT INTO public.user_roles(user_id,role) VALUES('{uid(i)}','admin');\nINSERT INTO public.employee_positions(user_id,position_id,pay_rate,effective_date) VALUES('{uid(i)}','{uid(300)}',1,current_date);\n"
    case('INSERT INTO probe_safety_violations DEFAULT VALUES',[1,2,4,5],'safety_violation','/safety/violations/'+uid(900),'violation_id')
    # An expired/future President who is admin is still eligible via admin.
    sql += f"INSERT INTO public.user_roles(user_id,role) VALUES('{uid(6)}','admin');\n"
    case('INSERT INTO probe_safety_violations DEFAULT VALUES',[1,2,4,5,6],'safety_violation')
    # Date boundaries are inclusive and multiple active appointments deduplicate.
    sql += f"INSERT INTO public.employee_positions(user_id,position_id,pay_rate,effective_date,end_date) VALUES('{uid(5)}','{uid(300)}',1,current_date,current_date);\n"
    case('INSERT INTO probe_safety_violations DEFAULT VALUES',[1,2,4,5,6],'safety_violation')
# Restore and check exact original trigger states before rollback; rollback also
# removes every fixture and reverses deletes. Disconnect on any error aborts tx.
sql += """DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT n.nspname,c.relname,t.tgname,o.tgenabled FROM original_triggers o JOIN pg_trigger t ON t.oid=o.oid JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','pgmq') LOOP
 EXECUTE format('ALTER TABLE %I.%I %s TRIGGER %I',r.nspname,r.relname,CASE r.tgenabled WHEN 'O' THEN 'ENABLE' WHEN 'D' THEN 'DISABLE' WHEN 'A' THEN 'ENABLE ALWAYS' WHEN 'R' THEN 'ENABLE REPLICA' END,r.tgname);
 END LOOP;
 IF EXISTS(SELECT 1 FROM original_triggers o JOIN pg_trigger t ON t.oid=o.oid WHERE o.tgenabled<>t.tgenabled) THEN RAISE EXCEPTION 'Trigger restoration failed'; END IF;
END $$;
ROLLBACK;
"""
query(sql)
assert query("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.notify_safety_violation()'::regprocedure;") == source_hash
assert query("SELECT count(*) FROM auth.users WHERE id::text LIKE '79000000-0000-4000-8000-%';") == '0'
print(f'PASS: 11 source-matching functions; 9 exact event bindings; {checks} recipient/gating/payload cases; rollback and fixture absence confirmed. No outbound hooks or SMTP executed.')
if args.candidate:
    print('PASS: source duplicate reproduced, candidate emits exactly one per distinct eligible recipient; source function restored after rollback.')
else:
    print('OBSERVED: safety violation duplicates notification for an active President who is also admin; source behavior retained. Temporary event tables do not certify full-table RLS/constraints or email delivery.')
