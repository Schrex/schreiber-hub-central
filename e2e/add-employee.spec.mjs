import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createEmployeeHandler } from '../supabase/functions/create-employee/handler.ts';
import { localStatus } from '../scripts/local-backend.mjs';

// Local Edge runtime is disabled. Adapt the exact production handler to Playwright
// while using real local Auth and database requests; this is not Deno gateway proof.
test('admin adds contact and login through wizard; duplicate error stays visible', async ({ browser }) => {
  const status = localStatus();
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const handler = createEmployeeHandler(createClient, { url: status.API_URL, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY });
  const suffix = randomUUID();
  const name = `Browser-${suffix}`;
  const context = await browser.newContext();
  const contactIds = []; const userIds = [];
  let simulateCleanupFailure = false;
  await context.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (!['http://127.0.0.1:8082','http://127.0.0.1:55321'].includes(url.origin)) return route.abort();
    if (url.pathname !== '/functions/v1/create-employee') return route.continue();
    if (simulateCleanupFailure && request.method() === 'POST') {
      return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Employee setup failed and cleanup needs administrator review. Do not retry yet.', cleanupRequired: true, contactId: 'synthetic-reference' }) });
    }
    const response = await handler(new Request(request.url(), { method: request.method(), headers: request.headers(), ...(request.method() === 'POST' ? { body: request.postData() } : {}) }));
    const text = await response.text();
    if (request.method() === 'POST') {
      const result = JSON.parse(text);
      if (result.contactId) contactIds.push(result.contactId);
      if (result.userId) userIds.push(result.userId);
    }
    return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: text });
  });
  try {
    const page = await context.newPage();
    await page.goto('/auth');
    await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
    await page.getByLabel('Password', { exact: true }).fill('LocalOnly-12345!');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL('http://127.0.0.1:8082/');
    await page.goto('/employee-contacts');
    for (const login of [false,true]) {
      await page.getByRole('button', { name: 'Add Employee', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Add Employee', exact: true });
      await dialog.getByLabel('First name *', { exact: true }).fill('Synthetic');
      await dialog.getByLabel('Last name *', { exact: true }).fill(`${name}-${login}`);
      await dialog.getByLabel('Email', { exact: true }).fill(`${suffix}-${login}@example.test`);
      if (login) {
        await dialog.getByRole('switch', { name: 'Create app login' }).click();
        await dialog.getByLabel('Default password *').fill('LocalOnly-12345!');
      }
      await dialog.getByRole('button', { name: 'Create employee', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText(`Synthetic ${name}-${login}`, { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByText(`Synthetic ${name}-${login}`, { exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Add Employee', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Employee', exact: true });
    await dialog.getByLabel('First name *', { exact: true }).fill('Duplicate');
    await dialog.getByLabel('Last name *', { exact: true }).fill('Synthetic');
    await dialog.getByLabel('Email', { exact: true }).fill(`${suffix}-false@example.test`);
    await dialog.getByRole('button', { name: 'Create employee', exact: true }).click();
    await expect(page.getByText('An employee or login with this email already exists', { exact: true }).first()).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create employee', exact: true })).toBeEnabled();
    simulateCleanupFailure = true;
    await dialog.getByLabel('Email', { exact: true }).fill(`${suffix}-uncertain@example.test`);
    await dialog.getByRole('button', { name: 'Create employee', exact: true }).click();
    await expect(page.getByText(/Contact reference: synthetic-reference/).first()).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create employee', exact: true })).toBeDisabled();
  } finally {
    await context.close();
    for (const id of userIds) expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
    for (const id of contactIds) expect((await service.from('employee_contacts').delete().eq('id', id)).error).toBeNull();
  }
});
