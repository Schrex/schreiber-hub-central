import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { root } from './local-backend.mjs';

const source = ts.createSourceFile('types.ts', readFileSync(`${root}/src/integrations/supabase/types.ts`, 'utf8'), ts.ScriptTarget.Latest, true);
const database = source.statements.find(s => ts.isTypeAliasDeclaration(s) && s.name.text === 'Database');
function member(type, name) {
  const result = type?.members?.find(m => m.name?.getText(source).replaceAll('"', '') === name);
  if (!result?.type) throw new Error(`Cannot parse generated schema member: ${name}`);
  return result.type;
}
const tables = member(member(database?.type, 'public'), 'Tables');
const expected = Object.fromEntries(tables.members.map(table => [table.name.getText(source),
  member(table.type, 'Row').members.map(column => column.name.getText(source))]));
// Fixed container and SELECT-only catalog query; no hosted DB credentials involved.
const query = `SELECT json_object_agg(table_name, columns) FROM (
  SELECT c.relname AS table_name, json_agg(a.attname ORDER BY a.attnum) AS columns
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
  WHERE n.nspname='public' AND c.relkind IN ('r','p') GROUP BY c.relname
) inventory`;
const actual = JSON.parse(execFileSync('docker', ['exec', 'supabase_db_schreiber-local',
  'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', query], { encoding: 'utf8' }));
const missingTables = Object.keys(expected).filter(t => !actual[t]);
const extraTables = Object.keys(actual).filter(t => !expected[t]);
const columnDifferences = Object.entries(expected).filter(([t]) => actual[t]).flatMap(([table, columns]) => {
  const missing = columns.filter(c => !actual[table].includes(c));
  const extra = actual[table].filter(c => !columns.includes(c));
  return missing.length || extra.length ? [{ table, missing, extra }] : [];
});
console.log(JSON.stringify({
  comparison: 'Local catalog versus checked-in client types; NOT a production parity certification',
  expectedTables: Object.keys(expected).length, localTables: Object.keys(actual).length,
  missingTables, extraTables, columnDifferences,
  limitations: 'Does not compare types, defaults, constraints, policies, functions, triggers, views or live Cloud state.',
}, null, 2));
if (missingTables.length || extraTables.length || columnDifferences.length) process.exitCode = 1;
