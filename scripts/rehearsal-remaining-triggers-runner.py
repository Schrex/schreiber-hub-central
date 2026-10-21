#!/usr/bin/env python3
"""Activate only 14 reviewed remaining triggers; no rows/access changes."""
from pathlib import Path
import hashlib
import importlib.util
import json
import os
import time
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('fixes',ROOT/'scripts/rehearsal-behavior-fixes-runner.py')
fixes=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixes)
ARCHIVE=fixes.ARCHIVE
EVIDENCE_PIN='fbfb4d683327f9af081a4a25c7ee196dcc447602059c2f9a4c4dc781c26574e8'
FUNCTIONS={'seed_job_contact_slots': ('539fe70b792aea57e771962f37daad30', True), 'sync_profile_to_contact': ('e88812c43fefd9950af9fffbe9c4fc38', True), 'notify_swpppp_report': ('7e249b8cee3838c367a83bd149d0eb89', True), 'sync_employee_contact_name': ('e3ea685a31ea311ed9e692e56e28bb7f', False), 'notify_accident_report': ('bbee038a782384e3141ed3c7442ba212', True), 'notify_time_off_changes': ('225b5e5c102443ec65f3884da6ab98da', True), 'notify_user': ('44f82968412f06f8e5c805e66285be9a', True), 'notify_role': ('4d1db09125b2ac3c0b847408cb4c5fa9', True), 'notify_safety_talk_attendee': ('378302b0b42154daddbd4efc5e109788', True), 'notify_truck_request_changes': ('70e9313add85b1861fc0a587191d14b5', True), 'notify_safety_violation': ('85d0c1902cb505f4852baf5772d0920f', True), 'sync_contact_to_profile': ('5126732fa6ec0230d0b2287af6bf5ad2', True), 'trg_seed_job_contact_slots': ('a134a18bfcf202f8cfc181e22aef6417', True), 'notify_schedule_assignment': ('8a09fd62296118ceb2c43536ce316059', True), 'sync_employee_contact_display_email': ('b2a23fe580abff94a7f8eb12ea3e895b', False), 'notify_equipment_rental_changes': ('3921e41ad7b2bc88ae799f83e43ee824', True), 'notify_clothing_order_changes': ('16024f516a29250216adb416d346921c', True)}

def quote(s):return "'"+s.replace("'","''")+"'"
def core(evidence):
    if hashlib.sha256(evidence.encode()).hexdigest()!=EVIDENCE_PIN:raise ValueError('Reviewed evidence changed')
    ts=json.loads(evidence)['triggers']
    targets=[t for t in ts if t['state']=='D']
    if len(ts)!=70 or len(targets)!=14:raise ValueError('Unexpected inventory')
    def check(active):
        values=','.join('('+','.join(quote(v) for v in [t['table'],t['name'],t['definition'].replace('public.',''),'O' if active else t['state']])+')' for t in ts)
        return """DO $$ BEGIN
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal)<>70 OR
 (SELECT count(*) FROM (VALUES %s) e(tbl,trg,def,state) JOIN pg_class c ON c.relnamespace='public'::regnamespace AND c.relname=e.tbl JOIN pg_trigger t ON t.tgrelid=c.oid AND t.tgname=e.trg WHERE NOT t.tgisinternal AND t.tgenabled::text=e.state AND replace(pg_get_triggerdef(t.oid),'public.','')=e.def AND c.relrowsecurity AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname='postgres'))<>70 THEN RAISE EXCEPTION 'Trigger definition/state mismatch; reconcile before retry'; END IF;
END $$;
""" % values
    sql=check(False)
    for name,(digest,definer) in FUNCTIONS.items():
        sql+=f"""DO $$ BEGIN
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='{name}')<>1 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='{name}' AND md5(prosrc)='{digest}' AND prosecdef={str(definer).lower()} AND proconfig=ARRAY['search_path=public'] AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')) THEN RAISE EXCEPTION 'Function/dependency mismatch'; END IF;
END $$;
"""
    sql+="""LOCK TABLE public.job_contact_template_slots IN SHARE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.job_contact_template_slots WHERE is_active GROUP BY category,role_label,COALESCE(material,'') HAVING count(DISTINCT (COALESCE(default_name,''),sort_order))>1) THEN RAISE EXCEPTION 'Conflicting templates require review'; END IF;
END $$;
"""
    sql+='\n'.join(f'ALTER TABLE public.{t["table"]} ENABLE TRIGGER {t["name"]};' for t in targets)
    return sql+'\n'+check(True)+"SELECT 'PASS: all 70 reviewed business triggers active; keep login/API/email/workers OFF' AS result;\n"

if __name__=='__main__':
    os.umask(0o077)
    sql=fixes.audit.ISOLATION.replace('19761019,16','19761019,18')+core((ARCHIVE/'behavior-review/hosted-behavior-fixes-postcheck.json').read_text())
    out=ARCHIVE/f'remaining-triggers-run-{time.time_ns()}';out.mkdir(mode=0o700)
    (out/'install.sql').write_text(sql);print(out)
