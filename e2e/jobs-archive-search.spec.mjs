// Jobs Archive search, year filter and paging (#33).
// Local synthetic data only; the backend is shared, so every check searches for this run's
// unique prefix (or a run-unique foreman/customer name) and counts only prefixed cards.
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../scripts/local-backend.mjs';

const PASSWORD = 'LocalOnly-12345!';
const BULK = 27;

test('Archive search by name, number, foreman and customer; year filter; paging; empty state', async ({ browser }) => {
  test.setTimeout(120_000);
  const status = localStatus();
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const run = randomUUID().slice(0, 8);
  const prefix = `ArchSearch ${run}`;
  const foremanName = `Synthetic Foreman ${run}`;
  const foremanEmail = `archive-foreman-${run}@example.test`;
  const customer = `Customer ${run}`;
  const contexts = [];
  let foremanId;
  const checked = result => { if (result.error) throw result.error; return result.data; };

  async function login(b, email, path) {
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
  const prefixedCards = (page) => page.getByRole('link').filter({ hasText: prefix });
  const search = (page) => page.getByRole('searchbox', { name: 'Search archive' });
  const year = (page) => page.getByLabel('Year');
  const names = { alpha: `${prefix} Alpha Bridge`, unknown: `${prefix} Lost Paperwork`, nye: `${prefix} New Years Eve`, running: `${prefix} Still Running` };

  try {
    const created = checked(await service.auth.admin.createUser({ email: foremanEmail, password: PASSWORD, email_confirm: true, user_metadata: { display_name: foremanName } }));
    foremanId = created.user.id;
    checked(await service.from('user_roles').insert({ user_id: foremanId, role: 'foreman' }));
    const unknownId = randomUUID();
    // Multi-row inserts send null for keys a row omits, so every row sets its own id.
    checked(await service.from('jobs').insert([
      { id: randomUUID(), name: names.alpha, job_number: `AS-${run}-1`, foreman_id: foremanId, customer, status: 'complete', completed_at: '2024-07-01T16:00:00Z' },
      { id: unknownId, name: names.unknown, status: 'complete' },
      // 10pm Dec 31 2023 in New York, already 2024 in UTC.
      { id: randomUUID(), name: names.nye, status: 'complete', completed_at: '2024-01-01T03:00:00Z' },
      { id: randomUUID(), name: names.running, foreman_id: foremanId, customer, status: 'active' },
      ...Array.from({ length: BULK }, (_, i) => ({
        id: randomUUID(), name: `${prefix} Bulk ${String(i + 1).padStart(2, '0')}`, status: 'complete', completed_at: `2023-03-${String(i + 1).padStart(2, '0')}T16:00:00Z`,
      })),
    ]));
    checked(await service.from('jobs').update({ completed_at: null }).eq('id', unknownId));
    const archivedTotal = BULK + 3;

    const foreman = await login(browser, foremanEmail, '/jobs?view=archive');

    // Paging: 25 per page, then the rest; active jobs never appear.
    await search(foreman).fill(prefix);
    await expect(prefixedCards(foreman)).toHaveCount(25);
    await expect(foreman.getByText(`Showing 25 of ${archivedTotal}`)).toBeVisible();
    await foreman.getByRole('button', { name: 'Load more' }).click();
    await expect(prefixedCards(foreman)).toHaveCount(archivedTotal);
    await expect(foreman.getByRole('button', { name: 'Load more' })).toHaveCount(0);
    await expect(prefixedCards(foreman).filter({ hasText: names.running })).toHaveCount(0);
    await expect(foreman.getByRole('region').last()).toHaveAttribute('aria-label', 'Date unknown');

    // Search by name, job number, foreman name and (foreman and above) customer.
    await search(foreman).fill(`${prefix} alpha`);
    await expect(prefixedCards(foreman)).toHaveCount(1);
    await expect(prefixedCards(foreman)).toContainText(names.alpha);
    await search(foreman).fill(`as-${run}-1`);
    await expect(prefixedCards(foreman)).toHaveCount(1);
    await expect(prefixedCards(foreman)).toContainText(names.alpha);
    await search(foreman).fill(foremanName.toLowerCase());
    await expect(prefixedCards(foreman)).toHaveCount(1);
    await expect(prefixedCards(foreman)).toContainText(names.alpha);
    await search(foreman).fill(customer);
    await expect(prefixedCards(foreman)).toHaveCount(1);
    await expect(prefixedCards(foreman)).toContainText(names.alpha);

    // Year filter uses New York calendar years; "Date unknown" lists undated jobs.
    await search(foreman).fill(prefix);
    await year(foreman).selectOption('2024');
    await expect(prefixedCards(foreman)).toHaveCount(1);
    await expect(prefixedCards(foreman)).toContainText(names.alpha);
    await year(foreman).selectOption('2023');
    await expect(prefixedCards(foreman)).toHaveCount(25);
    await expect(foreman.getByText(`Showing 25 of ${BULK + 1}`)).toBeVisible();
    await expect(prefixedCards(foreman).filter({ hasText: names.nye })).toHaveCount(1);
    await year(foreman).selectOption({ label: 'Date unknown' });
    await expect(prefixedCards(foreman)).toHaveCount(1);
    await expect(prefixedCards(foreman)).toContainText(names.unknown);

    // Empty state; special characters are matched literally rather than breaking the filter.
    await year(foreman).selectOption({ label: 'All years' });
    await search(foreman).fill(`${prefix} (no, match)%`);
    await expect(foreman.getByText('No archived jobs match')).toBeVisible();
    await expect(prefixedCards(foreman)).toHaveCount(0);

    // Employees can't search by customer.
    const employee = await login(browser, 'employee@example.test', '/jobs?view=archive');
    await search(employee).fill(foremanName);
    await expect(prefixedCards(employee)).toHaveCount(1);
    await search(employee).fill(customer);
    await expect(employee.getByText('No archived jobs match')).toBeVisible();
    await expect(prefixedCards(employee)).toHaveCount(0);
  } finally {
    for (const context of contexts) await context.close();
    checked(await service.from('jobs').delete().like('name', `${prefix}%`));
    if (foremanId) {
      checked(await service.from('employee_contacts').delete().eq('converted_user_id', foremanId));
      checked(await service.auth.admin.deleteUser(foremanId));
    }
  }
});
