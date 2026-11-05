// Local synthetic check: UI access rules (src/lib/accessRules.ts) never allow more than RLS.
// Every rule linked to a table is probed on the fixed loopback backend as synthetic users per role
// plus an assigned and an unassigned foreman. Update/delete probes count affected rows.
// UI-only rules are listed, not probed. No hosted URL or real-data inputs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/** Compare UI and RLS for one rule check. probes: [{ actor, ui, rls }]. */
export function judge(rule, probes) {
  const exceeds = probes.filter(p => p.ui && !p.rls).map(p => p.actor);
  if (exceeds.length) return { verdict: 'ui-exceeds-rls', actors: exceeds };
  const wider = probes.filter(p => !p.ui && p.rls).map(p => p.actor);
  if (!wider.length) return { verdict: 'match', actors: [] };
  return { verdict: rule.narrower ? 'narrower' : 'unrecorded-difference', actors: wider };
}

const DENIED = '42501';
const nyDate = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
  .format(new Date(Date.now() + offsetDays * 86400000));
// Notification triggers record these metadata keys for fixture ids.
const NOTIFY_KEYS = ['order_id', 'rental_id', 'violation_id', 'assignment_id', 'report_id', 'request_id', 'truck_request_id'];

async function main() {
  const { ACCESS_RULES } = await import('../src/lib/accessRules.ts');
  const { decide } = await import('../src/lib/accessDecision.ts'); // the UI's own decision
  const { createClient } = await import('@supabase/supabase-js');
  const { localStatus } = await import('./local-backend.mjs');
  const status = localStatus(); // Fixed loopback only; never env/hosted keys.
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const client = key => createClient(status.API_URL, key, options);
  const service = client(status.SERVICE_ROLE_KEY);
  const ok = (r) => { assert.equal(r.error, null, r.error?.message); return r.data; };
  const prefix = `access-policy-${randomUUID()}`;
  const users = [], rows = [], actors = [];
  let dayOffset = 10;

  async function createUser(name, roles) {
    const email = `${prefix}-${name}@example.test`;
    const password = `Local-${randomUUID()}!`;
    const id = ok(await service.auth.admin.createUser({ email, password, email_confirm: true })).user.id;
    users.push(id);
    ok(await service.from('user_roles').delete().eq('user_id', id));
    if (roles.length) ok(await service.from('user_roles').insert(roles.map(role => ({ user_id: id, role }))));
    return { id, email, password };
  }
  async function serviceInsert(table, row) {
    const id = randomUUID();
    rows.push([table, id]);
    ok(await service.from(table).insert({ id, ...row }));
    return id;
  }

  try {
    const owner = await createUser('owner', ['employee']);
    const specs = [
      ['employee', ['employee'], false], ['foreman-assigned', ['foreman'], true],
      ['foreman-unassigned', ['foreman'], false], ['office', ['office'], false], ['admin', ['admin'], false],
    ];
    for (const [name, roles, assignedForeman] of specs) {
      const user = await createUser(name, roles);
      const api = client(status.ANON_KEY);
      ok(await api.auth.signInWithPassword({ email: user.email, password: user.password }));
      actors.push({ name, roles, assignedForeman, id: user.id, api });
    }
    const assignedId = actors.find(a => a.assignedForeman).id;
    const jobId = await serviceInsert('jobs', { name: `${prefix} job`, foreman_id: assignedId });
    const clothingItemId = await serviceInsert('clothing_items', { name: `${prefix} shirt` });
    const equipmentId = await serviceInsert('equipment_items', { name: `${prefix} compactor` });
    const talkId = await serviceInsert('toolbox_talks', { title: `${prefix} talk`, content: 'Synthetic' });
    let serial = 0;
    const label = () => `${prefix} row ${serial++}`; // unique: some names carry unique constraints
    const file = `${prefix}/synthetic.pdf`;

    // Minimal synthetic row per table. `user` is the actor for inserts and another employee for fixtures.
    const fixtures = {
      jobs: () => ({ name: label() }),
      lookahead_plans: () => ({ job_id: jobId, week_start: '2026-11-09', weeks: 3, status: 'draft', source: 'manual' }),
      job_contacts: () => ({ job_id: jobId, name: label() }),
      dig_tickets: () => ({ job_id: jobId }),
      job_permits: () => ({ job_id: jobId, permit_type: label() }),
      job_plans: () => ({ job_id: jobId, title: label(), file_path: file, category: 'civil' }),
      job_photos: () => ({ job_id: jobId, file_path: file }),
      job_submittals: () => ({ job_id: jobId, title: label() }),
      swpppp_reports: () => ({ job_id: jobId, week_of: nyDate() }),
      job_scope_items: () => ({ job_id: jobId, body: label() }),
      job_estimates: () => ({ job_id: jobId, title: label(), file_path: file }),
      truck_requests: user => ({ job_id: jobId, requested_date: nyDate(7), requester_id: user }),
      dispatch_orders: () => ({ job_id: jobId }),
      schedule_assignments: user => ({ job_id: jobId, user_id: user, assignment_date: nyDate(dayOffset++) }),
      whiteboard_tiles: () => ({ label: label(), section: 'jobs', kind: 'job', day_index: 0, week_start: nyDate(7) }),
      employee_contacts: () => ({ name: label() }),
      vendors: () => ({ name: label() }),
      safety_rules: () => ({ title: label(), body: 'Synthetic' }),
      toolbox_talks: () => ({ title: label(), content: 'Synthetic' }),
      toolbox_talk_sessions: user => ({ talk_id: talkId, foreman_id: user, job_id: jobId }),
      safety_violations: user => ({ employee_name: label(), filed_by_name: label(), filed_by: user, violation_date: nyDate() }),
      time_off_requests: user => ({ user_id: user, start_date: nyDate(30), end_date: nyDate(31) }),
      performance_reviews: user => ({ employee_user_id: user }),
      handbook_documents: () => ({ title: label(), file_path: file }),
      referrals: user => ({ type: 'hire', referee_name: label(), referrer_user_id: user }),
      clothing_items: () => ({ name: label() }),
      clothing_orders: user => ({ user_id: user, item_id: clothingItemId, item_name: label(), size: 'L', color: 'Orange', quantity: 1 }),
      shop_reservations: user => ({ user_id: user, purpose: label(), reserved_date: nyDate(7) }),
      equipment_items: () => ({ name: label() }),
      equipment_rentals: user => ({
        user_id: user, equipment_id: equipmentId, equipment_name: label(), start_date: nyDate(7), end_date: nyDate(8),
        waiver_name: label(), waiver_text: 'Synthetic', waiver_signature_path: file,
      }),
    };

    // Returns whether RLS let the actor perform cmd on a synthetic row of table.
    async function probe(actor, table, cmd) {
      const build = fixtures[table];
      assert.ok(build, `no synthetic fixture for ${table}`);
      if (cmd === 'insert') {
        const id = randomUUID();
        rows.push([table, id]);
        const r = await actor.api.from(table).insert({ id, ...build(actor.id) });
        if (r.error) { assert.equal(r.error.code, DENIED, `${table} insert: ${r.error.message}`); return false; }
        assert.equal(ok(await service.from(table).select('id').eq('id', id)).length, 1, `${table} insert not stored`);
        return true;
      }
      const id = await serviceInsert(table, build(owner.id));
      const r = cmd === 'update'
        ? await actor.api.from(table).update({ id }, { count: 'exact' }).eq('id', id)
        : await actor.api.from(table).delete({ count: 'exact' }).eq('id', id);
      if (r.error) { assert.equal(r.error.code, DENIED, `${table} ${cmd}: ${r.error.message}`); return false; }
      assert.ok(r.count === 0 || r.count === 1, `${table} ${cmd} count ${r.count}`);
      const stored = ok(await service.from(table).select('id').eq('id', id)).length;
      if (cmd === 'delete') assert.equal(stored, 1 - r.count, `${table} delete count disagrees with stored rows`);
      return r.count === 1;
    }

    const cache = new Map();
    const report = [], failures = [], uiOnly = [];
    for (const [action, rule] of Object.entries(ACCESS_RULES)) {
      if (rule.rls === 'ui-only') { uiOnly.push(action); continue; }
      for (const { table, cmd } of rule.rls) {
        const probes = [];
        for (const actor of actors) {
          const key = `${table}.${cmd}.${actor.name}`;
          if (!cache.has(key)) cache.set(key, await probe(actor, table, cmd));
          probes.push({ actor: actor.name, ui: decide(rule, { userId: actor.id, roles: actor.roles, previewRole: null }, { foremanId: assignedId }), rls: cache.get(key) });
        }
        const result = judge(rule, probes);
        const allowed = pick => probes.filter(p => p[pick]).map(p => p.actor).join(',') || '-';
        report.push({ action, check: `${table}.${cmd}`, ui: allowed('ui'), rls: allowed('rls'), ...result });
        if (result.verdict === 'ui-exceeds-rls' || result.verdict === 'unrecorded-difference') failures.push(report.at(-1));
      }
    }
    console.log('| Action | Check | UI allows | RLS allows | Verdict |\n| --- | --- | --- | --- | --- |');
    for (const r of report) {
      const note = r.actors.length ? ` (${r.actors.join(',')})` : '';
      console.log(`| ${r.action} | ${r.check} | ${r.ui} | ${r.rls} | ${r.verdict}${note} |`);
    }
    console.log(`\nUI-only (not probed): ${uiOnly.join(', ')}`);
    assert.deepEqual(failures.map(f => `${f.action} ${f.check}: ${f.verdict} ${f.actors.join(',')}`), [],
      'UI access rules must never exceed RLS, and differences need a recorded narrower reason');
    console.log(`PASS: ${report.length} rule checks across ${cache.size} probes; UI never exceeds RLS.`);
  } finally {
    for (const actor of actors) await actor.api.auth.signOut();
    const ids = rows.map(([, id]) => id);
    for (let i = 0; i < ids.length; i += 50) {
      for (const key of NOTIFY_KEYS) ok(await service.from('notifications').delete().in(`metadata->>${key}`, ids.slice(i, i + 50)));
    }
    // Children before parents; job children cascade with the job.
    for (const [table, id] of rows.reverse()) ok(await service.from(table).delete().eq('id', id));
    for (const id of users) {
      ok(await service.from('notifications').delete().eq('user_id', id));
      ok(await service.from('employee_contacts').delete().eq('converted_user_id', id));
      ok(await service.auth.admin.deleteUser(id));
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
