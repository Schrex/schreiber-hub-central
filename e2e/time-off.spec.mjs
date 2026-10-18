import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../scripts/local-backend.mjs';

test('employee request is private, admin approves, employee reads persisted approval', async ({ browser }) => {
  const status = localStatus(); // Fixed-loopback guard; keys stay in this Node process.
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const reason = `Browser smoke ${randomUUID()}`;
  const contexts = [];
  async function signIn(email) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:8082', timezoneId: 'America/New_York' });
    contexts.push(context);
    await context.route('**/*', route => {
      const origin = new URL(route.request().url()).origin;
      return ['http://127.0.0.1:8082', 'http://127.0.0.1:55321'].includes(origin)
        ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    await page.goto('/auth');
    await expect(page.getByText('Local test environment.', { exact: false })).toBeVisible();
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('LocalOnly-12345!');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL('http://127.0.0.1:8082/');
    const loaded = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/rest/v1/time_off_requests' && response.request().method() === 'GET');
    await page.goto('/time-off');
    expect((await loaded).ok()).toBe(true);
    await expect(page.getByRole('heading', { name: 'Time Off', exact: true })).toBeVisible();
    return page;
  }
  try {
    const employee = await signIn('employee@example.test');
    await employee.getByRole('button', { name: 'Request', exact: true }).click();
    const form = employee.getByRole('dialog', { name: 'New time off request' });
    await form.getByRole('button', { name: 'Pick', exact: true }).first().click();
    // Two months ahead avoids short-notice rules throughout the year.
    await employee.getByRole('button', { name: 'Go to next month' }).click();
    await employee.getByRole('button', { name: 'Go to next month' }).click();
    await employee.getByRole('gridcell', { name: '15', exact: true }).click();
    await employee.keyboard.press('Escape');
    await form.getByPlaceholder('e.g. family vacation').fill(reason);
    await form.getByRole('button', { name: 'Submit request', exact: true }).click();
    const mine = employee.getByRole('tabpanel', { name: 'My Requests' });
    const request = mine.locator('div.rounded-xl').filter({ hasText: reason });
    await expect(request).toBeVisible();
    await expect(request.getByText('pending', { exact: true })).toBeVisible();

    const other = await signIn('other@example.test');
    await expect(other.getByRole('tab', { name: /Approvals/ })).toHaveCount(0);
    await expect(other.getByText(reason, { exact: true })).toHaveCount(0);

    const admin = await signIn('admin@example.test');
    await admin.getByRole('tab', { name: /Approvals/ }).click();
    const pending = admin.getByRole('tabpanel').locator('div.rounded-xl').filter({ hasText: reason });
    await expect(pending.getByText('pending', { exact: true })).toBeVisible();
    await pending.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(pending).toHaveCount(0);
    // Reload proves persistence without relying on disabled local Realtime.
    await employee.reload();
    await expect(request.getByText('approved', { exact: true })).toBeVisible();
    const reloaded = other.waitForResponse(response =>
      new URL(response.url()).pathname === '/rest/v1/time_off_requests' && response.request().method() === 'GET');
    await other.reload();
    expect((await reloaded).ok()).toBe(true);
    await expect(other.getByText(reason, { exact: true })).toHaveCount(0);
  } finally {
    // Also cleans up an insert that succeeded just before a failed UI assertion.
    await Promise.all(contexts.map(context => context.close()));
    const { error } = await service.from('time_off_requests').delete().eq('reason', reason);
    expect(error).toBeNull();
  }
});
