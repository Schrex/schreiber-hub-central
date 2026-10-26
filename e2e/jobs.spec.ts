// Jobs page Active/Archive tabs and the office status lifecycle (#32).
// Local synthetic data only; the backend is shared, so checks are scoped to a per-run name
// prefix and tab counts are checked as changes, not exact numbers.
import { randomUUID } from 'node:crypto';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../scripts/local-backend.mjs';

const PASSWORD = 'LocalOnly-12345!';

function newYorkDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

test('Jobs tabs, status changes, Undo and Reopen', async ({ browser }) => {
  test.setTimeout(120_000);
  const status = localStatus();
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const run = randomUUID().slice(0, 8);
  const prefix = `JobsE2E ${run}`;
  const officeName = `Synthetic Office ${run}`;
  const officeEmail = `jobs-office-${run}@example.test`;
  const contexts: BrowserContext[] = [];
  let officeId: string | undefined;
  const checked = <T,>(result: { data: T; error: unknown }): T => { if (result.error) throw result.error; return result.data; };

  async function login(b: Browser, email: string, path: string): Promise<Page> {
    const context = await b.newContext({ baseURL: 'http://127.0.0.1:8082' });
    contexts.push(context);
    await context.route('**/*', route => ['http://127.0.0.1:8082', 'http://127.0.0.1:55321'].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto('/auth');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL('http://127.0.0.1:8082/');
    await page.goto(path);
    return page;
  }
  const ids = { running: randomUUID(), older: randomUUID(), held: randomUUID(), heldBlank: randomUUID(), done2025: randomUUID(), doneUnknown: randomUUID() };
  const names = {
    running: `${prefix} Running`, older: `${prefix} Older`, held: `${prefix} Paused`, heldBlank: `${prefix} Stalled`,
    done2025: `${prefix} Done 2025`, doneUnknown: `${prefix} Done unknown`,
  };
  const jobRow = async (id: string) => checked(await service.from('jobs').select('status, hold_reason, completed_at, completed_by').eq('id', id).single());
  const tabCount = async (page: Page, tab: 'Active' | 'Archive') => {
    const text = await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).getByTestId('tab-count').textContent();
    return Number(text);
  };
  const prefixedCards = (page: Page) => page.getByRole('link').filter({ hasText: prefix });

  try {
    const created = checked(await service.auth.admin.createUser({ email: officeEmail, password: PASSWORD, email_confirm: true, user_metadata: { display_name: officeName } }));
    officeId = created.user.id;
    checked(await service.from('user_roles').insert({ user_id: officeId, role: 'office' }));
    checked(await service.from('jobs').insert([
      { id: ids.running, name: names.running, job_number: `E2E-${run}-1`, address: '1 Synthetic Rd', foreman_id: officeId, status: 'active', start_date: '2026-09-01' },
      { id: ids.older, name: names.older, status: 'active', start_date: '2026-01-01' },
      { id: ids.held, name: names.held, status: 'on_hold', hold_reason: 'Waiting on synthetic permit', start_date: '2026-10-01' },
      { id: ids.heldBlank, name: names.heldBlank, status: 'on_hold', start_date: '2026-05-01' },
      { id: ids.done2025, name: names.done2025, status: 'complete', customer: `Customer ${run}`, completed_at: '2025-06-15T16:00:00Z' },
      { id: ids.doneUnknown, name: names.doneUnknown, status: 'complete' },
    ]));
    // A complete row may have its date corrected; null models legacy rows with no completion date.
    checked(await service.from('jobs').update({ completed_at: null }).eq('id', ids.doneUnknown));

    // Active tab: running jobs first (newest start first), then on-hold jobs with their reason.
    const office = await login(browser, officeEmail, '/jobs');
    await expect(office.getByRole('tab', { name: /^Active/ })).toHaveAttribute('aria-selected', 'true');
    await expect(office.getByRole('button', { name: /New/ })).toBeVisible();
    await expect(prefixedCards(office)).toHaveCount(4);
    const order = await prefixedCards(office).locator('[data-testid="job-name"]').allTextContents();
    expect(order).toEqual([names.running, names.older, names.held, names.heldBlank]);
    const runningCard = prefixedCards(office).filter({ hasText: names.running });
    await expect(runningCard).toContainText(`#E2E-${run}-1`);
    await expect(runningCard).toContainText('1 Synthetic Rd');
    await expect(runningCard).toContainText(officeName);
    await expect(prefixedCards(office).filter({ hasText: names.held })).toContainText('Waiting on synthetic permit');
    await expect(prefixedCards(office).filter({ hasText: names.heldBlank })).toContainText('No reason given');

    // Archive tab: URL synced, no New button, newest first with "Date unknown" last; office sees customer.
    await office.getByRole('tab', { name: /^Archive/ }).click();
    await expect(office).toHaveURL(/[?&]view=archive/);
    await expect(office.getByRole('button', { name: /New/ })).toHaveCount(0);
    await expect(prefixedCards(office)).toHaveCount(2);
    const archived2025 = prefixedCards(office).filter({ hasText: names.done2025 });
    await expect(archived2025).toContainText(`Customer ${run}`);
    const unknownGroup = office.getByRole('region', { name: 'Date unknown' });
    await expect(unknownGroup.getByRole('link', { name: new RegExp(names.doneUnknown) })).toBeVisible();
    await expect(office.getByRole('region').last()).toHaveAttribute('aria-label', 'Date unknown');
    await expect(office.getByRole('region', { name: '2025' }).getByRole('link', { name: new RegExp(names.done2025) })).toBeVisible();

    // Deep link opens the Archive tab directly.
    await office.goto('/jobs?view=archive');
    await expect(office.getByRole('tab', { name: /^Archive/ })).toHaveAttribute('aria-selected', 'true');
    await office.goto('/jobs');
    await expect(prefixedCards(office)).toHaveCount(4);
    const active0 = await tabCount(office, 'Active');
    const archive0 = await tabCount(office, 'Archive');

    // Complete with a backdated date, then Undo.
    const today = newYorkDate(new Date());
    const backdated = newYorkDate(new Date(Date.now() - 3 * 86_400_000));
    await office.goto(`/jobs/${ids.running}`);
    await office.getByRole('button', { name: 'Change status' }).click();
    const sheet = office.getByRole('dialog', { name: 'Change status' });
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled();
    await sheet.getByRole('radio', { name: /Complete/ }).click();
    const dateField = sheet.getByLabel('Completed on');
    await expect(dateField).toHaveValue(today);
    await expect(dateField).toHaveAttribute('max', today);
    await dateField.fill(backdated);
    await sheet.getByRole('button', { name: 'Save' }).click();
    const banner = office.getByRole('region', { name: 'Archived' });
    await expect(banner).toContainText(officeName);
    let row = await jobRow(ids.running);
    expect(row.status).toBe('complete');
    expect(row.completed_by).toBe(officeId);
    expect(newYorkDate(new Date(row.completed_at!))).toBe(backdated);
    await office.getByRole('button', { name: 'Undo' }).click();
    await expect(office.getByText('Status change undone')).toBeVisible();
    await expect(banner).toHaveCount(0);
    row = await jobRow(ids.running);
    expect(row).toMatchObject({ status: 'active', completed_at: null, completed_by: null });

    // Undo after a concurrent change reports instead of overwriting.
    await office.goto(`/jobs/${ids.older}`);
    await office.getByRole('button', { name: 'Change status' }).click();
    await sheet.getByRole('radio', { name: /On hold/ }).click();
    await sheet.getByLabel(/Reason/).fill('Synthetic rain delay');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(office.getByRole('button', { name: 'Undo' })).toBeVisible();
    expect(await jobRow(ids.older)).toMatchObject({ status: 'on_hold', hold_reason: 'Synthetic rain delay' });
    checked(await service.from('jobs').update({ status: 'complete' }).eq('id', ids.older));
    await office.getByRole('button', { name: 'Undo' }).click();
    await expect(office.getByText('Changed by someone else; not undone')).toBeVisible();
    expect((await jobRow(ids.older)).status).toBe('complete');

    // Completing moves the job to the Archive immediately.
    await office.goto(`/jobs/${ids.running}`);
    await office.getByRole('button', { name: 'Change status' }).click();
    await sheet.getByRole('radio', { name: /Complete/ }).click();
    await sheet.getByLabel('Completed on').fill(backdated);
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(banner).toBeVisible();
    await office.goto('/jobs');
    await expect(prefixedCards(office)).toHaveCount(2); // held + heldBlank remain active
    // running → archive (−1/+1); older was completed by the concurrent writer (−1/+1).
    expect(await tabCount(office, 'Active')).toBe(active0 - 2);
    expect(await tabCount(office, 'Archive')).toBe(archive0 + 2);
    await office.getByRole('tab', { name: /^Archive/ }).click();
    await expect(prefixedCards(office).filter({ hasText: names.running })).toBeVisible();

    // Reopen clears the completion fields.
    await prefixedCards(office).filter({ hasText: names.running }).click();
    await office.getByRole('region', { name: 'Archived' }).getByRole('button', { name: 'Reopen' }).click();
    await expect(office.getByRole('region', { name: 'Archived' })).toHaveCount(0);
    expect(await jobRow(ids.running)).toMatchObject({ status: 'active', completed_at: null, completed_by: null });

    // Employee: archive cards hide the customer; archived job shows the banner but no controls.
    const employee = await login(browser, 'employee@example.test', '/jobs?view=archive');
    await expect(prefixedCards(employee).filter({ hasText: names.done2025 })).toBeVisible();
    await expect(prefixedCards(employee).filter({ hasText: names.done2025 })).not.toContainText(`Customer ${run}`);
    await employee.goto(`/jobs/${ids.done2025}`);
    const employeeBanner = employee.getByRole('region', { name: 'Archived' });
    await expect(employeeBanner).toContainText('Unknown');
    await expect(employeeBanner).toContainText('Jun 15, 2025');
    await expect(employee.getByRole('button', { name: 'Reopen' })).toHaveCount(0);
    await expect(employee.getByRole('button', { name: 'Change status' })).toHaveCount(0);
    await employee.goto(`/jobs/${ids.doneUnknown}`);
    await expect(employee.getByRole('region', { name: 'Archived' })).toContainText('Date unknown');
  } finally {
    for (const context of contexts) await context.close();
    checked(await service.from('jobs').delete().like('name', `${prefix}%`));
    if (officeId) {
      checked(await service.from('employee_contacts').delete().eq('converted_user_id', officeId));
      checked(await service.auth.admin.deleteUser(officeId));
    }
  }
});
