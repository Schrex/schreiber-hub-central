// Build a fixed, inert database-baseline import. No credentials or SQL execution.
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const archiveRoot = '/Users/sumanththota/Schrex/archive/database-2026-10-19';
export const fingerprints = {
  'public-pre.sql': '7bc24930149c5a03ad72781f2c18346f63ab55ad9debf02623b1f0f561899c9c',
  'auth-accounts.sql': '8ff7ea018dd33f26e7e55249d7a7fd3bdede08ce8a306bccece038db6168569b',
  'public-data.sql': '2b0f737dbdba6ae96b8326a28acaa10d0442f7531cac539fbf8cc357bde1d404',
  'public-post.sql': 'd4e4a97cce661e810956debddf8f2ceeeff9e7cd61bb925ac80a3269056fb5ec',
};
export function verifyParts(parts) {
  for (const [name, hash] of Object.entries(fingerprints)) {
    if (!parts[name] || createHash('sha256').update(parts[name]).digest('hex') !== hash)
      throw new Error(`Reviewed artifact mismatch: ${name}`);
  }
}
export function dataCounts(sql) {
  const counts = {}; let table = null;
  for (const line of sql.split('\n')) {
    if (table !== null) {
      if (line === '\\.') table = null;
      else counts[table]++;
    } else if (line.startsWith('COPY ')) {
      const m = /^COPY ((?:public|auth)\.[a-z_]+) \(.+\) FROM stdin;$/.exec(line);
      if (!m || Object.hasOwn(counts, m[1])) throw new Error('Unexpected COPY section');
      table = m[1]; counts[table] = 0;
    }
  }
  if (table !== null) throw new Error('Incomplete COPY section');
  return counts;
}
export const preflight = `
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '10min';
SELECT pg_advisory_xact_lock(19761019, 10);
DO $guard$
BEGIN
 IF current_database() <> 'postgres' OR current_user <> 'postgres' THEN
  RAISE EXCEPTION 'Unexpected database or role';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S'))
 OR EXISTS (SELECT 1 FROM auth.users) OR EXISTS (SELECT 1 FROM auth.identities)
 OR EXISTS (SELECT 1 FROM auth.sessions) OR EXISTS (SELECT 1 FROM auth.refresh_tokens)
 OR EXISTS (SELECT 1 FROM storage.buckets) OR EXISTS (SELECT 1 FROM storage.objects) THEN
  RAISE EXCEPTION 'Destination is not empty; no cleanup or overwrite permitted';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_extension WHERE extname IN ('pg_cron','pg_net','pgmq')) THEN
  RAISE EXCEPTION 'Unexpected scheduler/network/queue installation';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'Unexpected account mutation trigger';
 END IF;
 IF rehearsal_guard.block_email('{}'::jsonb) IS DISTINCT FROM
  '{"error":{"http_code":403,"message":"Email delivery blocked during migration rehearsal"}}'::jsonb THEN
  RAISE EXCEPTION 'Email block function mismatch';
 END IF;
END $guard$;
`;
export function verificationSql(counts) {
  const checks = Object.entries(counts).map(([table, count]) => {
    if (!/^(public|auth)\.[a-z_]+$/.test(table) || !Number.isSafeInteger(count) || count < 0) throw new Error('Invalid count');
    return `IF (SELECT count(*) FROM ${table}) <> ${count} THEN RAISE EXCEPTION 'Row count mismatch: ${table}'; END IF;`;
  }).join('\n');
  return `
-- No source triggers, workers, schedules, storage policies or client grants activate.
REVOKE ALL ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
DO $verify$
BEGIN
${checks}
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') <> 60 THEN RAISE EXCEPTION 'Business table count mismatch'; END IF;
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity) THEN RAISE EXCEPTION 'RLS missing'; END IF;
 IF EXISTS (SELECT 1 FROM auth.identities i LEFT JOIN auth.users u ON u.id=i.user_id WHERE u.id IS NULL) THEN RAISE EXCEPTION 'Orphan identity'; END IF;
 IF EXISTS (SELECT 1 FROM public.profiles p LEFT JOIN auth.users u ON u.id=p.user_id WHERE u.id IS NULL) THEN RAISE EXCEPTION 'Orphan profile'; END IF;
 IF EXISTS (SELECT 1 FROM auth.users WHERE encrypted_password IS NULL OR encrypted_password='') THEN RAISE EXCEPTION 'Missing password hash'; END IF;
 IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal) THEN RAISE EXCEPTION 'Unexpected business trigger'; END IF;
END $verify$;
`;
}
// Managed Auth foreign keys already exist: users must precede identities.
// Move whole COPY blocks verbatim; never parse or rewrite account fields/hashes.
export function orderAuthAccounts(sql) {
  const pattern = /^COPY auth\.(users|identities) \([^\n]+\) FROM stdin;\n[\s\S]*?^\\\.\n/gm;
  const blocks = [...sql.matchAll(pattern)];
  if (blocks.length !== 2 || new Set(blocks.map(m => m[1])).size !== 2)
    throw new Error('Expected exactly two complete account COPY blocks');
  const users = blocks.find(m => m[1] === 'users')[0];
  const identities = blocks.find(m => m[1] === 'identities')[0];
  let index = 0;
  return sql.replace(pattern, () => index++ === 0 ? users : identities);
}
export function buildSql(parts) {
  verifyParts(parts);
  const counts = {...dataCounts(parts['auth-accounts.sql']), ...dataCounts(parts['public-data.sql'])};
  if (Object.keys(counts).length !== 62) throw new Error('Expected 62 COPY sections');
  return preflight + '\n' + Object.keys(fingerprints).map(name => name === 'auth-accounts.sql' ? orderAuthAccounts(parts[name]) : parts[name]).join('\n') + verificationSql(counts);
}
function privateFile(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('Private regular file required');
  return readFileSync(path, 'utf8');
}
export function prepare() {
  for (const dir of [archiveRoot, `${archiveRoot}/candidate-import`]) {
    const stat = lstatSync(dir);
    if (realpathSync(dir) !== dir || !stat.isDirectory() || (stat.mode & 0o077)) throw new Error('Private real directory required');
  }
  const parts = Object.fromEntries(Object.keys(fingerprints).map(name => [name, privateFile(`${archiveRoot}/candidate-import/${name}`)]));
  const sql = buildSql(parts);
  const out = `${archiveRoot}/runner-${Date.now()}`;
  mkdirSync(out, {mode:0o700});
  writeFileSync(`${out}/import.sql`, sql, {mode:0o600, flag:'wx'});
  writeFileSync(`${out}/manifest.json`, JSON.stringify({target:'acgqjjbrnkmeazswdnzp', scope:'inert_database_baseline', sha256:createHash('sha256').update(sql).digest('hex'), files:fingerprints},null,2), {mode:0o600,flag:'wx'});
  return out;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('No arguments accepted');
  console.log(prepare());
}
