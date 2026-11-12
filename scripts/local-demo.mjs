// One-command local test environment for clicking through features by hand.
//
//   bun run local:demo              Docker check -> local backend -> demo data -> app on :8080
//   bun run local:demo --seed-only  add/refresh demo data, do not start the app
//   bun run local:demo --clean      remove the demo data again (before verify:* runs)
//
// Fixed loopback backend only (localStatus refuses anything else). All data is synthetic:
// @example.test accounts with the disposable local password. Never point this at production.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { localStatus, root } from './local-backend.mjs';

const args = new Set(process.argv.slice(2));
const PASSWORD = 'LocalOnly-12345!';
const JOB_NUMBER = 'DEMO-001';
const USERS = [
  { email: 'foreman@example.test', name: 'Demo Foreman', role: 'foreman', onJob: 'foreman' },
  { email: 'crew1@example.test', name: 'Demo Operator', role: 'employee', onJob: 'operator' },
  { email: 'crew2@example.test', name: 'Demo Laborer', role: 'employee', onJob: 'laborer' },
];
const TALKS = [
  {
    title: 'Demo: Trench Safety',
    category: 'Excavation',
    content: [
      'Never enter a trench 5 feet or deeper unless it has a protective system (sloping, shoring or a trench box).',
      'Keep spoil piles and equipment at least 2 feet back from the edge.',
      'A competent person inspects the trench every day before work and after rain.',
      'In a trench 4 feet or deeper, a ladder must be within 25 feet of every worker.',
    ].join('\n\n'),
    quiz_questions: [
      { question: 'At what depth is a protective system required?', options: ['3 feet', '5 feet', '10 feet'], correct_index: 1 },
      { question: 'How far back must spoil piles be kept?', options: ['6 inches', '1 foot', '2 feet'], correct_index: 2 },
      { question: 'Max distance to a ladder in a 4 ft+ trench?', options: ['25 feet', '50 feet', '100 feet'], correct_index: 0 },
    ],
  },
  {
    title: 'Demo: Heat Stress (no quiz)',
    category: 'Health',
    content: 'Drink water every 15 minutes, rest in the shade, and watch each other for dizziness, confusion or sweating that stops.',
    quiz_questions: [],
  },
];

const ok = (result, what) => {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
};
const todayInNewYork = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

function dockerRunning() {
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

async function ensureDocker() {
  if (dockerRunning()) return;
  // Claude Code cloud sessions ship Docker but do not start the daemon.
  if (process.env.CLAUDE_CODE_REMOTE === 'true' && process.platform === 'linux') {
    console.log('Starting the Docker daemon for this cloud session…');
    spawn('dockerd', [], { detached: true, stdio: 'ignore' }).unref();
    for (let i = 0; i < 30 && !dockerRunning(); i += 1) await new Promise((r) => setTimeout(r, 1000));
    if (dockerRunning()) return;
  }
  console.error('Docker is not running. Start Docker Desktop (or the Docker daemon) and run this again.');
  process.exit(1);
}

function ensureBackend() {
  try {
    return localStatus();
  } catch {
    console.log('Local backend not running — starting it (first run downloads images, a few minutes)…');
    execFileSync('bun', ['run', 'local:start'], { cwd: root, stdio: 'inherit' });
    return localStatus();
  }
}

async function findUser(service, email) {
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`list users: ${error.message}`);
  return data.users.find((u) => u.email === email) ?? null;
}

async function seed(service) {
  const ids = {};
  for (const u of USERS) {
    let user = await findUser(service, u.email);
    if (!user) {
      user = ok(await service.auth.admin.createUser({
        email: u.email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: u.name },
      }), `create ${u.email}`).user;
    }
    ids[u.email] = user.id;
    ok(await service.from('profiles').update({ display_name: u.name }).eq('user_id', user.id), `name ${u.email}`);
    const roles = ok(await service.from('user_roles').select('role').eq('user_id', user.id), 'read roles');
    if (!roles.some((r) => r.role === u.role)) {
      ok(await service.from('user_roles').insert({ user_id: user.id, role: u.role }), `role ${u.email}`);
    }
  }

  let job = ok(await service.from('jobs').select('id').eq('job_number', JOB_NUMBER).maybeSingle(), 'read job');
  if (!job) {
    job = ok(await service.from('jobs').insert({
      name: 'Demo Main St Sewer', job_number: JOB_NUMBER, address: '100 Example St',
    }).select('id').single(), 'create job');
  }

  const today = todayInNewYork();
  for (const u of USERS) {
    const existing = ok(await service.from('schedule_assignments').select('id')
      .eq('job_id', job.id).eq('user_id', ids[u.email]).eq('assignment_date', today), 'read schedule');
    if (existing.length === 0) {
      ok(await service.from('schedule_assignments').insert({
        job_id: job.id, user_id: ids[u.email], assignment_date: today, role_on_job: u.onJob,
      }), `schedule ${u.email}`);
    }
  }

  for (const t of TALKS) {
    const existing = ok(await service.from('toolbox_talks').select('id').eq('title', t.title), 'read talks');
    if (existing.length === 0) ok(await service.from('toolbox_talks').insert({ ...t, is_active: true }), `talk ${t.title}`);
  }
  return today;
}

async function clean(service) {
  const talks = ok(await service.from('toolbox_talks').select('id').in('title', TALKS.map((t) => t.title)), 'read talks');
  const talkIds = talks.map((t) => t.id);
  if (talkIds.length) {
    const sessions = ok(await service.from('toolbox_talk_sessions').select('id').in('talk_id', talkIds), 'read sessions');
    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length) {
      ok(await service.from('toolbox_talk_attendees').delete().in('session_id', sessionIds), 'delete attendees');
      ok(await service.from('toolbox_talk_sessions').delete().in('id', sessionIds), 'delete sessions');
    }
    ok(await service.from('toolbox_talks').delete().in('id', talkIds), 'delete talks');
  }
  const job = ok(await service.from('jobs').select('id').eq('job_number', JOB_NUMBER).maybeSingle(), 'read job');
  if (job) {
    ok(await service.from('schedule_assignments').delete().eq('job_id', job.id), 'delete schedule');
    ok(await service.from('jobs').delete().eq('id', job.id), 'delete job');
  }
  for (const u of USERS) {
    const user = await findUser(service, u.email);
    if (user) {
      const { error } = await service.auth.admin.deleteUser(user.id);
      if (error) console.warn(`Could not delete ${u.email}: ${error.message}`);
    }
  }
  // Account creation also creates an employee contact (handle_new_user); its unique name would
  // block the next seed.
  ok(await service.from('employee_contacts').delete().in('email', USERS.map((u) => u.email)), 'delete contacts');
}

await ensureDocker();
const status = ensureBackend();
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

if (args.has('--clean')) {
  await clean(service);
  console.log('Demo data removed. The local backend is still running (stop it with: bun run local:stop).');
  process.exit(0);
}

const today = await seed(service);
console.log(`
Demo data ready (synthetic, local only) — scheduled for ${today} (New York):
  Job:    Demo Main St Sewer (${JOB_NUMBER})
  Talks:  "${TALKS[0].title}" (3-question quiz), "${TALKS[1].title}"

  Log in with email + password (password for all: ${PASSWORD})
    foreman@example.test   Demo Foreman   -> Safety > Sessions, start a talk
    crew1@example.test     Demo Operator  -> bell icon, take the quiz, sign
    crew2@example.test     Demo Laborer   -> same as crew1
    admin@example.test     Local Admin    -> everything, write talks
`);

if (args.has('--seed-only')) process.exit(0);
console.log('Starting the app at http://127.0.0.1:8080 (Ctrl+C to stop; the backend keeps running)…\n');
const child = spawn(process.execPath, ['scripts/local-dev.mjs'], { cwd: root, stdio: 'inherit' });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
