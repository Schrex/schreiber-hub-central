#!/usr/bin/env python3
"""Test exported validation functions with synthetic temporary rows; always rollback.
Fixed local Docker only. This isolates validation from RLS, FKs and other triggers;
it is not a full-table workflow or hosted activation test.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ARCHIVE = Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')

def query(sql):
    result = subprocess.run(['docker','exec','-i','supabase_db_schreiber-local','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'],input=sql,text=True,capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

def literal(value):
    return "'"+value.replace("'", "''")+"'"

source = (ARCHIVE/'inspection/schema.sql').read_text()
triggers = (ARCHIVE/'behavior-review/public-triggers-disabled.sql').read_text()
assert hashlib.sha256(triggers.encode()).hexdigest() == '995142ef62107a6a32d73cc6e723d56704d1e51c338ff1afc948627b276086e8'
names = ['validate_comp_history','validate_employee_benefit','validate_employee_position','validate_equipment_rental']
for name in names:
    body = re.search(r'CREATE FUNCTION public\.'+name+r'\(\).*?AS \$\$(.*?)\$\$;',source,re.S)[1]
    actual = json.loads(query("SELECT json_build_object('hash',md5(prosrc),'definer',prosecdef,'config',proconfig) FROM pg_proc WHERE oid="+literal('public.'+name+'()')+'::regprocedure;'))
    assert actual == {'hash':hashlib.md5(body.encode()).hexdigest(),'definer':False,'config':['search_path=public']}, name
fingerprint = "SELECT md5(string_agg(oid||':'||tgenabled::text,',' ORDER BY oid)) FROM pg_trigger;"
before = query(fingerprint)
sql = """BEGIN;
CREATE TEMP TABLE comp(id int, base_salary numeric, bonus numeric, benefits_value numeric, year int, total_compensation numeric);
CREATE TEMP TABLE benefit(id int, annual_value numeric, effective_date date, end_date date);
CREATE TEMP TABLE position_probe(id int, pay_rate numeric, effective_date date, end_date date);
CREATE TEMP TABLE rental(id int, start_date date, end_date date);
"""
mapping = {'employee_compensation_history':'comp','employee_benefits':'benefit','employee_positions':'position_probe','equipment_rentals':'rental'}
bindings = re.findall(r'^CREATE TRIGGER (\w+) BEFORE INSERT OR UPDATE ON public\.(\w+) FOR EACH ROW EXECUTE FUNCTION public\.(validate_\w+)\(\);$',triggers,re.M)
assert len(bindings)==5
for trigger, table, function in bindings:
    sql += f'CREATE TRIGGER {trigger} BEFORE INSERT OR UPDATE ON {mapping[table]} FOR EACH ROW EXECUTE FUNCTION public.{function}();\n'
sql += """
CREATE FUNCTION pg_temp.expect_rejection(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN SQLSTATE 'P0001' THEN
  IF SQLERRM=expected THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'Expected validation rejection did not occur';
END $$;
GRANT SELECT,INSERT,UPDATE ON comp,benefit,position_probe,rental TO authenticated;
SET LOCAL ROLE authenticated;
INSERT INTO comp VALUES(1,100,20,5,1900,-999),(2,0,0,0,extract(year from now())::int+1,-999);
UPDATE comp SET bonus=30,total_compensation=-999 WHERE id=1;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM comp WHERE id=1 AND total_compensation=135) OR NOT EXISTS(SELECT 1 FROM comp WHERE id=2 AND total_compensation=0) THEN RAISE EXCEPTION 'Compensation calculation failed'; END IF;
END $$;
INSERT INTO benefit VALUES(1,0,'2026-01-01','2026-01-01'),(2,10,'2026-01-01',NULL);
INSERT INTO position_probe VALUES(1,0,'2026-01-01','2026-01-01'),(2,10,'2026-01-01',NULL);
INSERT INTO rental VALUES(1,'2026-01-01','2026-01-01');
"""
cases=[]
for column in ['base_salary','bonus','benefits_value']:
    values={'base_salary':'100','bonus':'20','benefits_value':'5'};values[column]='-1'
    cases += [(f"INSERT INTO comp VALUES(99,{values['base_salary']},{values['bonus']},{values['benefits_value']},2026,0)",'compensation values cannot be negative'),(f'UPDATE comp SET {column}=-1 WHERE id=1','compensation values cannot be negative')]
for year in ['1899','extract(year from now())::int+2']:
    cases += [(f'INSERT INTO comp VALUES(99,1,2,3,{year},0)','invalid year'),(f'UPDATE comp SET year={year} WHERE id=1','invalid year')]
for table,col in [('benefit','annual_value'),('position_probe','pay_rate')]:
    cases += [(f"INSERT INTO {table} VALUES(99,-1,'2026-01-01',NULL)",f'{col} cannot be negative'),(f'UPDATE {table} SET {col}=-1 WHERE id=1',f'{col} cannot be negative'),(f"INSERT INTO {table} VALUES(99,1,'2026-01-02','2026-01-01')",'end_date must be on or after effective_date'),(f"UPDATE {table} SET end_date='2025-12-31' WHERE id=1",'end_date must be on or after effective_date')]
cases += [("INSERT INTO rental VALUES(99,'2026-01-02','2026-01-01')",'end_date must be on or after start_date'),("UPDATE rental SET end_date='2025-12-31' WHERE id=1",'end_date must be on or after start_date')]
# Compare whole row sets before/after every rejected INSERT/UPDATE.
for statement,message in cases:
    table = statement.split()[2] if statement.startswith('INSERT') else statement.split()[1]
    sql += f"DO $$ DECLARE prior jsonb; after_rows jsonb; BEGIN SELECT jsonb_agg(to_jsonb(t) ORDER BY id) INTO prior FROM {table} t; PERFORM pg_temp.expect_rejection({literal(statement)},{literal(message)}); SELECT jsonb_agg(to_jsonb(t) ORDER BY id) INTO after_rows FROM {table} t; IF prior IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'Rejected operation changed rows'; END IF; END $$;\n"
sql += 'RESET ROLE; ROLLBACK;'
query(sql)
assert query(fingerprint)==before
print(f'PASS: 4 source-matching functions, all 5 trigger bindings; valid boundaries and compensation recalculation; {len(cases)} INSERT/UPDATE rejections with exact SQLSTATE/message and whole-row preservation; rollback and unchanged trigger state.')
