// Structural pg_restore TOC selection. No SQL rewriting, execution or credentials.
const kinds = ['SEQUENCE OWNED BY','PUBLICATION TABLE','DEFAULT ACL','TABLE DATA','SEQUENCE SET','FK CONSTRAINT','ROW SECURITY','EVENT TRIGGER','MATERIALIZED VIEW DATA','MATERIALIZED VIEW','PROCEDURE','FUNCTION','CONSTRAINT','EXTENSION','PUBLICATION','SUBSCRIPTION','SEQUENCE','TRIGGER','POLICY','COMMENT','SCHEMA','TABLE','VIEW','TYPE','INDEX','DEFAULT','ACL'];
export function selectRestoreStages(toc) {
  const stages = { public_schema: [], public_data: [], auth_accounts: [], deferred: [] };
  const seen = new Set();
  for (const line of toc.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith(';')) continue;
    const match = /^(\d+); \d+ \d+ (.+)$/.exec(line);
    if (!match || seen.has(match[1])) throw new Error('Invalid or duplicate TOC entry');
    seen.add(match[1]);
    const kind = kinds.find(k => match[2].startsWith(k + ' '));
    if (!kind) { stages.deferred.push(line); continue; }
    const rest = match[2].slice(kind.length + 1);
    const schema = rest.split(' ')[0];
    // Every non-public object stays deferred except the two account data tables.
    if (kind === 'TABLE DATA' && /^auth (users|identities) \S+$/.test(rest)) {
      stages.auth_accounts.push(line);
    } else if (schema === 'public' && ['TABLE DATA','SEQUENCE SET'].includes(kind)) {
      stages.public_data.push(line);
    } else if (schema === 'public' && !/\bemail_queue_(dispatch|wake)\b/.test(rest)
      && !['TRIGGER','EVENT TRIGGER','PUBLICATION','PUBLICATION TABLE','SUBSCRIPTION','ACL','DEFAULT ACL'].includes(kind)) {
      stages.public_schema.push(line);
    } else stages.deferred.push(line);
  }
  if (!stages.auth_accounts.some(l => /TABLE DATA auth users /.test(l)) ||
      !stages.auth_accounts.some(l => /TABLE DATA auth identities /.test(l))) throw new Error('Account data missing');
  if (!stages.public_data.length) throw new Error('Business data missing');
  return stages;
}
