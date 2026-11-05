// Local synthetic look-ahead RLS checks. Published plans are readable by any
// signed-in user. Drafts and task writes stay office/admin. No hosted URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';

const status = localStatus();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = (key) => createClient(status.API_URL, key, options);
const service = client(status.SERVICE_ROLE_KEY);
const office = client(status.ANON_KEY);
const employee = client(status.ANON_KEY);
const anon = client(status.ANON_KEY);
const ok = (result) => { assert.equal(result.error, null, result.error?.message); return result.data; };
const denied = (result, label) => {
  assert.ok(result.error, `${label} should be denied`);
  assert.equal(result.error.code, '42501', `${label}: ${result.error.message}`);
};

const prefix = `lookahead-rls-${randomUUID()}`;
let officeId;
let draftId;
let foremanId;
let uploadJobId;

try {
  const email = `${prefix}@example.test`;
  const password = `Local-${randomUUID()}!`;
  officeId = ok(await service.auth.admin.createUser({ email, password, email_confirm: true })).user.id;
  ok(await service.from('user_roles').delete().eq('user_id', officeId));
  ok(await service.from('user_roles').insert({ user_id: officeId, role: 'office' }));
  ok(await office.auth.signInWithPassword({ email, password }));
  const employeeId = ok(await employee.auth.signInWithPassword({
    email: 'employee@example.test',
    password: 'LocalOnly-12345!',
  })).user.id;

  const job = ok(await service.from('jobs').select('id, lookahead_grid_enabled, job_number').eq('job_number', 'J2607').single());
  assert.equal(job.lookahead_grid_enabled, true, 'seeded Cobblestone must enable the grid');

  const plans = ok(await employee.from('lookahead_plans').select('id, week_start, weeks, status').eq('job_id', job.id).eq('status', 'published'));
  assert.equal(plans.length, 1);
  assert.deepEqual(
    { week_start: plans[0].week_start, weeks: plans[0].weeks, status: plans[0].status },
    { week_start: '2026-11-09', weeks: 3, status: 'published' },
  );
  const planId = plans[0].id;

  const tasks = ok(await employee.from('lookahead_tasks').select('id, name, contractor_name, group_name').eq('plan_id', planId).order('sort_order'));
  assert.deepEqual(tasks.map((task) => task.name), [
    'Strip Topsoil', 'Cut to export', 'Cut to fill', 'Tap sleeve w/valve', 'Sample Tap', 'Hot Box',
  ]);
  assert.ok(tasks.every((task) => task.contractor_name === 'Schreiber'));
  const hot = tasks.find((task) => task.name === 'Hot Box');
  const days = ok(await employee.from('lookahead_task_days').select('work_date').eq('task_id', hot.id).order('work_date'));
  assert.deepEqual(days.map((day) => day.work_date), ['2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25']);
  const holidays = ok(await employee.from('lookahead_plan_holidays').select('holiday_date, label').eq('plan_id', planId).order('holiday_date'));
  assert.deepEqual(holidays.map((row) => [row.holiday_date, row.label]), [
    ['2026-11-26', 'Thanksgiving'],
    ['2026-11-27', 'Thanksgiving'],
  ]);
  const changes = ok(await employee.from('lookahead_changes').select('id').eq('plan_id', planId));
  assert.ok(changes.length > 0, 'published change log is readable');
  console.log('PASS: employee reads the published Cobblestone grid, holidays, and change log.');

  denied(await employee.from('lookahead_tasks').insert({
    plan_id: planId,
    name: 'Should fail',
    contractor_type: 'schreiber',
    contractor_name: 'Schreiber',
    sort_order: 99,
  }), 'employee task insert');
  denied(await employee.from('lookahead_acks').insert({
    plan_id: planId,
    user_id: employeeId,
    kind: 'problem',
    comment: 'Synthetic problem that must not land',
  }), 'employee problem insert');
  const anonRead = await anon.from('lookahead_plans').select('id').eq('id', planId);
  if (anonRead.error) assert.ok(anonRead.error);
  else assert.equal(anonRead.data.length, 0);
  console.log('PASS: employee cannot insert a task or a problem; anon cannot read the plan.');

  draftId = ok(await service.from('lookahead_plans').insert({
    job_id: job.id,
    week_start: '2026-12-07',
    weeks: 3,
    status: 'draft',
    source: 'manual',
  }).select('id').single()).id;
  const hiddenPlan = ok(await employee.from('lookahead_plans').select('id').eq('id', draftId));
  assert.equal(hiddenPlan.length, 0, 'employee must not read a draft plan');

  const draftTask = ok(await office.from('lookahead_tasks').insert({
    plan_id: draftId,
    name: 'Office draft row',
    contractor_type: 'crew',
    contractor_name: 'Craft',
    sort_order: 1,
  }).select('id').single());
  const hiddenTask = ok(await employee.from('lookahead_tasks').select('id').eq('id', draftTask.id));
  assert.equal(hiddenTask.length, 0, 'employee must not read a draft task');

  ok(await office.from('lookahead_plan_holidays').insert({
    plan_id: draftId, holiday_date: '2026-12-07', label: 'Synthetic',
  }));
  const holidayMark = await office.from('lookahead_task_days').insert({ task_id: draftTask.id, work_date: '2026-12-07' });
  assert.ok(holidayMark.error, 'a holiday must not accept an X');
  const weekendMark = await office.from('lookahead_task_days').insert({ task_id: draftTask.id, work_date: '2026-12-12' });
  assert.ok(weekendMark.error, 'Saturday must not accept an X');
  ok(await office.from('lookahead_task_days').insert({ task_id: draftTask.id, work_date: '2026-12-08' }));
  const removed = await office.from('lookahead_tasks').delete().eq('id', draftTask.id);
  assert.equal(removed.error, null, removed.error?.message);
  console.log('PASS: drafts stay office-only; holiday and weekend marks are rejected.');

  uploadJobId = ok(await service.from('jobs').insert({ name: `${prefix} upload`, status: 'active', lookahead_grid_enabled: false }).select('id, lookahead_grid_enabled').single()).id;
  const uploadJob = { id: uploadJobId };
  const payload = {
    source_filename: 'synthetic.xml',
    week_start: '2026-11-02',
    weeks: 4,
    skipped_placeholder_count: 1,
    holidays: [{ date: '2026-11-26', label: 'Thanksgiving' }],
    tasks: [{
      name: 'Hot Box', group_name: 'Water', contractor_type: 'schreiber', contractor_name: 'Schreiber',
      sort_order: 1, mpp_unique_id: 29, days: ['2026-11-23', '2026-11-24', '2026-11-25'],
    }],
  };
  denied(await employee.rpc('publish_lookahead_upload', { p_job_id: uploadJob.id, p_payload: payload }), 'employee upload');
  const foremanEmail = `${prefix}-foreman@example.test`;
  const foremanPassword = `Local-${randomUUID()}!`;
  foremanId = ok(await service.auth.admin.createUser({ email: foremanEmail, password: foremanPassword, email_confirm: true })).user.id;
  ok(await service.from('user_roles').delete().eq('user_id', foremanId));
  ok(await service.from('user_roles').insert({ user_id: foremanId, role: 'foreman' }));
  const foreman = client(status.ANON_KEY);
  ok(await foreman.auth.signInWithPassword({ email: foremanEmail, password: foremanPassword }));
  denied(await foreman.rpc('publish_lookahead_upload', { p_job_id: uploadJob.id, p_payload: payload }), 'foreman upload');
  const poisoned = await office.rpc('publish_lookahead_upload', { p_job_id: uploadJob.id, p_payload: { ...payload, cost: 10 } });
  assert.ok(poisoned.error, 'a cost field must be rejected');

  const firstId = ok(await office.rpc('publish_lookahead_upload', { p_job_id: uploadJob.id, p_payload: payload }));
  assert.equal(ok(await service.from('jobs').select('lookahead_grid_enabled').eq('id', uploadJob.id).single()).lookahead_grid_enabled, true);
  const live = ok(await employee.from('lookahead_plans').select('id, status, source').eq('job_id', uploadJob.id).eq('status', 'published'));
  assert.equal(live.length, 1);
  assert.equal(live[0].id, firstId);
  assert.equal(live[0].source, 'mspdi_xml');
  const seenDays = ok(await employee.from('lookahead_task_days').select('work_date').eq('task_id',
    ok(await employee.from('lookahead_tasks').select('id').eq('plan_id', firstId).single()).id,
  ));
  assert.deepEqual(seenDays.map((day) => day.work_date).sort(), ['2026-11-23', '2026-11-24', '2026-11-25']);

  const admin = client(status.ANON_KEY);
  ok(await admin.auth.signInWithPassword({ email: 'admin@example.test', password: 'LocalOnly-12345!' }));
  const secondId = ok(await admin.rpc('publish_lookahead_upload', {
    p_job_id: uploadJob.id,
    p_payload: { ...payload, tasks: [{ ...payload.tasks[0], name: 'Sample Tap', days: ['2026-11-19'] }] },
  }));
  assert.notEqual(secondId, firstId);
  assert.equal(ok(await employee.from('lookahead_plans').select('id').eq('id', firstId)).length, 0, 'field users do not see replaced versions');
  assert.equal(ok(await office.from('lookahead_plans').select('status').eq('id', firstId).single()).status, 'superseded');
  assert.equal(ok(await employee.from('lookahead_plans').select('id').eq('id', secondId)).length, 1);
  console.log('PASS: office and admin can publish; foreman and employee cannot; replaced versions stay off the field view.');
} finally {
  if (uploadJobId) await service.from('jobs').delete().eq('id', uploadJobId);
  if (draftId) await service.from('lookahead_plans').delete().eq('id', draftId);
  if (foremanId) {
    await service.from('employee_contacts').delete().eq('converted_user_id', foremanId);
    await service.auth.admin.deleteUser(foremanId);
  }
  if (officeId) {
    await service.from('employee_contacts').delete().eq('converted_user_id', officeId);
    await service.auth.admin.deleteUser(officeId);
  }
}
