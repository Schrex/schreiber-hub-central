// Offline comparison only. Never execute SQL or print row values/password hashes.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveRoot, fingerprints, verifyParts } from './migration-runner.mjs';
const digest = value => createHash('sha256').update(value).digest('hex');
export function parseCopy(sql) {
  const tables = new Map(); let current = null;
  for (const line of sql.split('\n')) {
    if (current) {
      if (line === '\\.') { current = null; continue; }
      current.rows.push(digest(line));
      continue;
    }
    if (!line.startsWith('COPY ')) continue;
    const m = /^COPY ((?:public|auth)\.[a-z_]+) \(([^\n]+)\) FROM stdin;$/.exec(line);
    if (!m || tables.has(m[1])) throw new Error('Unsupported or duplicate COPY section');
    current = { columns:m[2], rows:[] }; tables.set(m[1],current);
  }
  if (current) throw new Error('Incomplete COPY section');
  if (!tables.size) throw new Error('No COPY sections found');
  return tables;
}
export function compareCopies(source, destination) {
  const a=parseCopy(source), b=parseCopy(destination);
  const differences=[];
  for (const name of new Set([...a.keys(),...b.keys()])) {
    const x=a.get(name),y=b.get(name);
    if (!x || !y) { differences.push({table:name,reason:'table_set'}); continue; }
    if (x.columns!==y.columns) { differences.push({table:name,reason:'column_order'});continue; }
    if (x.rows.length!==y.rows.length) { differences.push({table:name,reason:'row_count'});continue; }
    if (digest(x.rows.sort().join('\n'))!==digest(y.rows.sort().join('\n'))) differences.push({table:name,reason:'row_content'});
  }
  return {passed:differences.length===0,sourceTables:a.size,destinationTables:b.size,differences};
}
export function reconcile(file) {
  if (!/^destination-data-\d{8}T\d{6}Z\.sql$/.test(file)) throw new Error('Unexpected capture filename');
  const parts=Object.fromEntries(Object.keys(fingerprints).map(n=>[n,readFileSync(`${archiveRoot}/candidate-import/${n}`,'utf8')]));
  verifyParts(parts);
  const destination=readFileSync(`${archiveRoot}/inspection/${file}`,'utf8');
  if (!destination.includes('-- PostgreSQL database dump complete')) throw new Error('Capture completion marker missing');
  const report=compareCopies(parts['auth-accounts.sql']+'\n'+parts['public-data.sql'],destination);
  if (report.sourceTables!==62) throw new Error('Unexpected source inventory');
  report.capture=file;
  report.captureSha256=digest(destination);
  report.scope='All COPY fields, including account UUIDs and password hashes; order-independent multiset comparison. Does not certify sequences, permissions, files or application behavior.';
  writeFileSync(`${archiveRoot}/inspection/${file}.comparison.json`,JSON.stringify(report,null,2),{mode:0o600,flag:'wx'});
  console.log(report.passed ? 'PASS: all 62 business/account COPY sections match the backup, including password hashes.' : 'MISMATCH: stop before files/access changes. Private comparison report saved.');
  if (!report.passed) process.exitCode=1;
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length!==3) throw new Error('Capture filename required');
    reconcile(process.argv[2]);
  } catch { console.error('Comparison could not complete. Keep evidence private; ask the assistant to inspect it.'); process.exitCode=1; }
}
