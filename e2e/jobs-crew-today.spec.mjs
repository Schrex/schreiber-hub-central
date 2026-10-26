// Active job cards show how many people are scheduled today, in New York time (#34).
// Local synthetic data only; the backend is shared, so checks are scoped to a per-run name prefix.
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../scripts/local-backend.mjs';

const PASSWORD = 'LocalOnly-12345!';

function newYorkDate(instant) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

test("Active job cards show today's crew", async ({ browser }) => {
  test.setTimeout(90_000);
  const status = localStatus();
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const run = randomUUID().slice(0, 8);
  const prefix = `CrewE2E ${run}`;
  const checked = result => { if (result.error) throw result.error; return result.data; };
  const contexts = [];
  const userIds = [];
  const ids = { crewed: randomUUID(), solo: randomUUID(), empty: randomUUID(), held: randomUUID() };
  const names = { crewed: `${prefix} Crewed`, solo: `${prefix} Solo`, empty: `${prefix} Empty`, held: `${prefix} Held` };

  try {
    for (const n of [1, 2, 3]) {
      const created = checked(await service.auth.admin.createUser({
        email: `crew-${run}-${n}@example.test`, password: PASSWORD, email_confirm: true,
        user_metadata: { display_name: `Synthetic Crew ${run} ${n}` },
      }));
      userIds.push(created.user.id);
    }
    const [a, b, c] = userIds;
    checked(await service.from('jobs').insert([
      { id: ids.crewed, name: names.crewed, status: 'active', start_date: '2026-10-03' },
      { id: ids.solo, name: names.solo, status: 'active', start_date: '2026-10-02' },
      { id: ids.empty, name: names.empty, status: 'active', start_date: '2026-10-01' },
      { id: ids.held, name: names.held, status: 'on_hold', hold_reason: 'Synthetic permit hold', start_date: '2026-09-01' },
    ]));
    const today = newYorkDate(new Date());
    const otherDay = newYorkDate(new Date(Date.now() - 2 * 86_400_000));
    // Service role bypasses the assignment date rule, so past dates can be seeded.
    checked(await service.from('schedule_assignments').insert([
      { job_id: ids.crewed, user_id: a, assignment_date: today },
      { job_id: ids.crewed, user_id: b, assignment_date: today },
      { job_id: ids.crewed, user_id: c, assignment_date: otherDay },
      { job_id: ids.solo, user_id: c, assignment_date: today },
      { job_id: ids.solo, user_id: a, assignment_date: otherDay },
      { job_id: ids.empty, user_id: a, assignment_date: otherDay },
      { job_id: ids.held, user_id: c, assignment_date: today },
    ]));

    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:8082' });
    contexts.push(context);
    await context.route('**/*', route => ['http://127.0.0.1:8082', 'http://127.0.0.1:55321'].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto('/auth');
    await page.getByLabel('Email', { exact: true }).fill('employee@example.test');
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL('http://127.0.0.1:8082/');

    const assignmentRequests = [];
    page.on('request', req => { if (req.url().includes('/rest/v1/schedule_assignments')) assignmentRequests.push(req.url()); });
    await page.goto('/jobs');
    const card = (name) => page.getByRole('link').filter({ hasText: name });
    await expect(card(names.crewed)).toContainText('2 people scheduled today');
    await expect(card(names.solo)).toContainText('1 person scheduled today');
    await expect(card(names.empty)).toContainText('No crew scheduled today');
    await expect(card(names.held)).toContainText('Synthetic permit hold');
    await expect(card(names.held)).not.toContainText(/scheduled today/);

    // One query for every visible card, filtered to today's New York date.
    expect(assignmentRequests).toHaveLength(1);
    expect(decodeURIComponent(assignmentRequests[0])).toContain(`assignment_date=eq.${today}`);
  } finally {
    for (const context of contexts) await context.close();
    checked(await service.from('jobs').delete().like('name', `${prefix}%`));
    for (const id of userIds) {
      checked(await service.from('employee_contacts').delete().eq('converted_user_id', id));
      checked(await service.auth.admin.deleteUser(id));
    }
  }
});
