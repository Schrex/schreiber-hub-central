import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../scripts/local-backend.mjs';

// Synthetic jobs only. The local backend is shared, so every assertion is scoped to this run's name prefix.
const status = localStatus();
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const checked = result => { if (result.error) throw result.error; return result.data; };
const allowed = ['http://127.0.0.1:8082', 'http://127.0.0.1:55321'];

const nyDate = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const addDays = (iso, days) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

async function login(browser, contexts, email) {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:8082' });
  contexts.push(context);
  await context.route('**/*', route => allowed.includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('LocalOnly-12345!');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:8082/');
  return page;
}

async function seedJobs(prefix) {
  const jobs = {
    active: { id: randomUUID(), name: `${prefix} Active`, status: 'active' },
    onHold: { id: randomUUID(), name: `${prefix} On hold`, status: 'on_hold', hold_reason: 'Synthetic pause' },
    complete: { id: randomUUID(), name: `${prefix} Complete`, status: 'complete' },
  };
  checked(await service.from('jobs').insert(Object.values(jobs)));
  return jobs;
}

const cleanupJobs = async (jobs) => checked(await service.from('jobs').delete().in('id', Object.values(jobs).map(j => j.id)));

test('Dispatch new-order picker offers active jobs only; existing orders keep a completed job', async ({ browser }) => {
  const prefix = `Pickers ${randomUUID().slice(0, 8)}`;
  const contexts = [];
  const jobs = await seedJobs(prefix);
  const truck = `T-${randomUUID().slice(0, 6)}`;
  try {
    checked(await service.from('dispatch_orders').insert({
      dispatch_date: nyDate(new Date()), truck_number: truck, job_id: jobs.complete.id, job_name: jobs.complete.name,
    }));
    const page = await login(browser, contexts, 'admin@example.test');
    await page.goto('/dispatch');

    const order = page.locator('div.rounded-xl', { hasText: `Truck #${truck}` });
    await expect(order.getByText(jobs.complete.name, { exact: true })).toBeVisible();
    await order.getByRole('button', { name: 'Edit', exact: true }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit Dispatch Order' });
    await expect(editDialog.getByRole('combobox').filter({ hasText: jobs.complete.name })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'New Order' }).click();
    const dialog = page.getByRole('dialog', { name: 'New Dispatch Order' });
    await dialog.getByRole('combobox').filter({ hasText: 'Select job' }).click();
    await expect(page.getByRole('option', { name: jobs.active.name })).toBeVisible();
    await expect(page.getByRole('option', { name: new RegExp(prefix) })).toHaveCount(1);
  } finally {
    for (const context of contexts) await context.close();
    checked(await service.from('dispatch_orders').delete().eq('truck_number', truck));
    await cleanupJobs(jobs);
  }
});

test('Accident and violation pickers include on-hold jobs but not completed ones', async ({ browser }) => {
  const prefix = `Pickers ${randomUUID().slice(0, 8)}`;
  const contexts = [];
  const jobs = await seedJobs(prefix);
  try {
    const page = await login(browser, contexts, 'admin@example.test');
    await page.goto('/safety');
    for (const button of ['Report an accident', 'Safety violation notice']) {
      await page.getByRole('button', { name: button }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('combobox').filter({ hasText: 'Select job (optional)' }).click();
      await expect(page.getByRole('option', { name: jobs.onHold.name })).toBeVisible();
      await expect(page.getByRole('option', { name: jobs.active.name })).toBeVisible();
      await expect(page.getByRole('option', { name: new RegExp(prefix) })).toHaveCount(2);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  } finally {
    for (const context of contexts) await context.close();
    await cleanupJobs(jobs);
  }
});

test('Schedule carry-forward copies active-job assignments and skips on-hold and completed jobs', async ({ browser }) => {
  const prefix = `Carry ${randomUUID().slice(0, 8)}`;
  const contexts = [];
  const jobs = await seedJobs(prefix);
  const created = checked(await service.auth.admin.createUser({ email: `carry-${randomUUID()}@example.test`, password: 'LocalOnly-12345!', email_confirm: true }));
  const userId = created.user.id;
  // A random future week keeps this run's target day away from other specs' data.
  const weeks = 6 + Math.floor(Math.random() * 10);
  const target = addDays(nyDate(new Date()), weeks * 7);
  const jobIds = Object.values(jobs).map(j => j.id);
  try {
    checked(await service.from('schedule_assignments').insert(Object.values(jobs).map(j => ({
      job_id: j.id, user_id: userId, assignment_date: addDays(target, -1), start_time: '07:00', notes: prefix,
    }))));
    const page = await login(browser, contexts, 'admin@example.test');
    await page.goto('/schedule');
    for (let i = 0; i < weeks; i++) await page.getByRole('button', { name: 'Next week' }).click();
    const copied = async () => (checked(await service.from('schedule_assignments').select('job_id')
      .eq('assignment_date', target).in('job_id', jobIds))).map(r => r.job_id);
    await expect.poll(copied, { timeout: 15_000 }).toEqual([jobs.active.id]);
  } finally {
    for (const context of contexts) await context.close();
    await cleanupJobs(jobs);
    checked(await service.from('notifications').delete().eq('user_id', userId));
    checked(await service.from('employee_contacts').delete().eq('converted_user_id', userId));
    checked(await service.auth.admin.deleteUser(userId));
  }
});
