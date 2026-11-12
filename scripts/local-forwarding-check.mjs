// Local check for the Daily Schedule forwarding (#98), against a stub Worker. No network or
// Cloudflare account: both run in Wrangler's local runtime, using the pinned release Wrangler.
//   bun install --cwd tooling/release --frozen-lockfile --ignore-scripts
//   node scripts/local-forwarding-check.mjs
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const wrangler = path.join(root, 'tooling/release/node_modules/wrangler/bin/wrangler.js');
if (!existsSync(wrangler)) throw new Error('Install the pinned release Wrangler first: bun install --cwd tooling/release --frozen-lockfile --ignore-scripts');

const work = mkdtempSync(path.join(tmpdir(), 'forwarding-check-'));
const stubPort = 8791, pagesPort = 8792, base = `http://127.0.0.1:${pagesPort}`;
mkdirSync(path.join(work, 'stub')); mkdirSync(path.join(work, 'site/static'), { recursive: true });
// The stub echoes what it received, so the check can compare it with what was sent.
writeFileSync(path.join(work, 'stub/index.js'), `export default { async fetch(request) {
  return new Response(JSON.stringify({ stub: true, method: request.method, url: request.url,
    authorization: request.headers.get('authorization'), cookie: request.headers.get('cookie'), body: await request.text() }),
    { status: 207, headers: { 'content-type': 'application/json', 'x-stub': 'yes', 'set-cookie': 'stub=1; Path=/daily-schedule' } });
} };\n`);
// Static site shaped like the release build: SPA fallback, headers, the approved routing file.
writeFileSync(path.join(work, 'site/static/index.html'), '<!doctype html><title>hub</title>\n');
writeFileSync(path.join(work, 'site/static/_redirects'), '/* /index.html 200\n');
writeFileSync(path.join(work, 'site/static/_headers'), '/*\n  X-Hub-Static: yes\n');
cpSync(path.join(root, 'public/_routes.json'), path.join(work, 'site/static/_routes.json'));
cpSync(path.join(root, 'functions'), path.join(work, 'site/functions'), { recursive: true });

const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' };
const date = ['--compatibility-date', '2026-10-01'];
const run = (cwd, args) => spawn(process.execPath, [wrangler, ...args, ...date], { cwd, env, stdio: 'ignore' });
const children = [run(path.join(work, 'stub'), ['dev', 'index.js', '--name', 'daily-schedule', '--port', String(stubPort), '--ip', '127.0.0.1'])];

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try { await fetch(url); return; } catch { await new Promise(r => setTimeout(r, 500)); }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const failures = [];
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failures.push(`${name}: ${detail}`); };
try {
  await waitFor(`http://127.0.0.1:${stubPort}/`);
  children.push(run(path.join(work, 'site'), ['pages', 'dev', 'static', '--port', String(pagesPort), '--ip', '127.0.0.1', '--service', 'DAILY_SCHEDULE=daily-schedule']));
  await waitFor(`${base}/`);
  for (const route of ['/daily-schedule', '/daily-schedule/', '/daily-schedule/settings?view=tv']) {
    const response = await fetch(`${base}${route}`, { redirect: 'manual' });
    const echo = await response.json().catch(() => ({}));
    check(`GET ${route} reaches the Worker`, response.status === 207 && echo.url === `${base}${route}` && response.headers.get('x-stub') === 'yes', JSON.stringify(echo));
    check(`GET ${route} answer is not given hub headers`, !response.headers.get('x-hub-static') && response.headers.get('set-cookie') === 'stub=1; Path=/daily-schedule', [...response.headers].join(' '));
  }
  const sent = { method: 'POST', headers: { Authorization: 'Bearer synthetic.token.value', Cookie: 'x=1', 'Content-Type': 'application/json' }, body: '{"placements":[1,2]}' };
  const response = await fetch(`${base}/daily-schedule/api/save?day=2026-11-12`, sent);
  const echo = await response.json().catch(() => ({}));
  check('POST keeps URL, method, Authorization, cookies and body', response.status === 207 && echo.method === 'POST' &&
    echo.url === `${base}/daily-schedule/api/save?day=2026-11-12` && echo.authorization === sent.headers.Authorization &&
    echo.cookie === 'x=1' && echo.body === sent.body, JSON.stringify(echo));
  for (const route of ['/', '/schedule', '/schedule/whiteboard', '/daily-schedulex', '/api/daily-schedule', '/jobs/daily-schedule/']) {
    const answer = await fetch(`${base}${route}`);
    const text = await answer.text();
    check(`GET ${route} stays static`, answer.status === 200 && text.includes('<title>hub</title>') && answer.headers.get('x-hub-static') === 'yes' && !answer.headers.get('x-stub'), text.slice(0, 80));
  }
} finally {
  for (const child of children) child.kill();
  rmSync(work, { recursive: true, force: true });
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('Forwarding check passed against the stub Worker (local only; not a production check).');
