// Leaving active status can remove a job's future schedule assignments and whiteboard tiles (#35).
// Local synthetic data only; the backend is shared, so every row is scoped to a per-run name prefix.
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../scripts/local-backend.mjs';
import { mondayOf, todayInNewYork } from '../src/lib/jobs';

const PASSWORD = 'LocalOnly-12345!';

const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const dayIndex = (date) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

test('Leaving active removes future assignments and tiles only when asked', async ({ browser }) => {
  test.setTimeout(120_000);
  const status = localStatus();
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const run = randomUUID().slice(0, 8);
  const prefix = `JobsCleanupE2E ${run}`;
  const officeEmail = `jobs-cleanup-office-${run}@example.test`;
  const contexts = [];
  let officeId;
  const checked = result => { if (result.error) throw result.error; return result.data; };

  const today = todayInNewYork();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);
  const ids = { cleaned: randomUUID(), kept: randomUUID() };

  async function seedSchedule(jobId, userId) {
    checked(await service.from('schedule_assignments').insert(
      [today, tomorrow, nextWeek].map(date => ({ job_id: jobId, user_id: userId, assignment_date: date, start_time: '07:00' })),
    ));
    const tile = (date) => ({
      id: randomUUID(), week_start: mondayOf(date), day_index: dayIndex(date), section: 'jobs', kind: 'job', ref_id: jobId, label: `${prefix} tile`,
    });
    const [past, current, soon, later] = [yesterday, today, tomorrow, nextWeek].map(tile);
    checked(await service.from('whiteboard_tiles').insert([past, current, soon, later]));
    // A crew tile under tomorrow's job tile goes with its parent by the existing cascade.
    checked(await service.from('whiteboard_tiles').insert({
      week_start: soon.week_start, day_index: soon.day_index, section: 'jobs', kind: 'crew', ref_id: userId, label: `${prefix} crew`, parent_tile_id: soon.id,
    }));
  }
  const assignmentDates = async (jobId) =>
    checked(await service.from('schedule_assignments').select('assignment_date').eq('job_id', jobId).order('assignment_date'))
      .map(r => r.assignment_date);
  const tileDays = async (jobId) =>
    checked(await service.from('whiteboard_tiles').select('week_start, day_index').eq('kind', 'job').eq('ref_id', jobId))
      .map(r => addDays(r.week_start, r.day_index)).sort();
  const crewTiles = async () => checked(await service.from('whiteboard_tiles').select('id').eq('label', `${prefix} crew`)).length;

  async function openSheet(page, jobId) {
    await page.goto(`/jobs/${jobId}`);
    await page.getByRole('button', { name: 'Change status' }).click();
    return page.getByRole('dialog', { name: 'Change status' });
  }

  try {
    const created = checked(await service.auth.admin.createUser({ email: officeEmail, password: PASSWORD, email_confirm: true, user_metadata: { display_name: `Synthetic Office ${run}` } }));
    officeId = created.user.id;
    checked(await service.from('user_roles').insert({ user_id: officeId, role: 'office' }));
    checked(await service.from('jobs').insert([
      { id: ids.cleaned, name: `${prefix} Cleaned`, status: 'active' },
      { id: ids.kept, name: `${prefix} Kept`, status: 'active' },
    ]));
    await seedSchedule(ids.cleaned, officeId);
    await seedSchedule(ids.kept, officeId);
    expect(await crewTiles()).toBe(2);

    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:8082' });
    contexts.push(context);
    await context.route('**/*', route => ['http://127.0.0.1:8082', 'http://127.0.0.1:55321'].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const office = await context.newPage();
    await office.goto('/auth');
    await office.getByLabel('Email', { exact: true }).fill(officeEmail);
    await office.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await office.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(office).toHaveURL('http://127.0.0.1:8082/');

    // Complete with cleanup on (the default): future rows go, today's and earlier stay.
    let sheet = await openSheet(office, ids.cleaned);
    await sheet.getByRole('radio', { name: /Complete/ }).click();
    const cleanup = sheet.getByRole('checkbox', { name: 'Remove 2 future assignments and 2 whiteboard tiles' });
    await expect(cleanup).toBeChecked();
    await expect(sheet).toContainText('Undo does not restore removed assignments or tiles');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(office.getByRole('region', { name: 'Archived' })).toBeVisible();
    await expect(office.getByText(/Removed 2 future assignments and 2 whiteboard tiles/)).toBeVisible();
    expect((await service.from('jobs').select('status').eq('id', ids.cleaned).single()).data?.status).toBe('complete');
    expect(await assignmentDates(ids.cleaned)).toEqual([today]);
    expect(await tileDays(ids.cleaned)).toEqual([yesterday, today]);
    expect(await crewTiles()).toBe(1); // only the kept job's crew tile remains

    // On hold with cleanup unchecked keeps every row.
    sheet = await openSheet(office, ids.kept);
    await sheet.getByRole('radio', { name: /On hold/ }).click();
    await sheet.getByRole('checkbox', { name: 'Remove 2 future assignments and 2 whiteboard tiles' }).click();
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(office.getByRole('button', { name: 'Undo' })).toBeVisible();
    expect((await service.from('jobs').select('status').eq('id', ids.kept).single()).data?.status).toBe('on_hold');
    expect(await assignmentDates(ids.kept)).toEqual([today, tomorrow, nextWeek]);
    expect(await tileDays(ids.kept)).toEqual([yesterday, today, tomorrow, nextWeek]);
    expect(await crewTiles()).toBe(1);
  } finally {
    for (const context of contexts) await context.close();
    checked(await service.from('whiteboard_tiles').delete().like('label', `${prefix}%`));
    checked(await service.from('jobs').delete().like('name', `${prefix}%`));
    if (officeId) {
      checked(await service.from('employee_contacts').delete().eq('converted_user_id', officeId));
      checked(await service.auth.admin.deleteUser(officeId));
    }
  }
});
