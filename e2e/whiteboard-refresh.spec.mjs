import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../scripts/local-backend.mjs';

test('Whiteboard reconciles two sessions without Realtime and retains data on refresh failure', async ({ browser }) => {
  const status = localStatus();
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const label = `Synthetic board ${randomUUID()}`;
  const contexts = [];
  async function signIn(email) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:8082', timezoneId: 'America/New_York' });
    contexts.push(context);
    await context.route('**/*', route => ['http://127.0.0.1:8082', 'http://127.0.0.1:55321'].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto('/auth');
    await expect(page.getByText('Local test environment.', { exact: false })).toBeVisible();
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('LocalOnly-12345!');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL('http://127.0.0.1:8082/');
    await page.goto('/schedule/whiteboard');
    return page;
  }
  try {
    const reader = await signIn('admin@example.test');
    await expect(reader.getByRole('button', { name: 'Task', exact: true }).first()).toBeVisible();
    const writer = await signIn('admin@example.test');
    await writer.getByRole('button', { name: 'Task', exact: true }).first().click();
    await writer.getByPlaceholder('Task…').fill(label);
    const inserted = writer.waitForResponse(r => new URL(r.url()).pathname === '/rest/v1/whiteboard_tiles' && r.request().method() === 'POST');
    await writer.getByRole('button', { name: 'Add', exact: true }).click();
    expect((await inserted).ok()).toBe(true);
    await expect(writer.getByRole('button', { name: label, exact: true })).toBeVisible();
    // Realtime is disabled locally. Exercise the actual resume handler explicitly;
    // native headless tab focus is not a reliable lifecycle event generator.
    await reader.bringToFront();
    await reader.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(reader.getByRole('button', { name: label, exact: true })).toBeVisible();

    await reader.route('**/rest/v1/whiteboard_tiles?*', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic offline check' }) }));
    await reader.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(reader.getByRole('alert')).toContainText('Could not refresh the board');
    await expect(reader.getByRole('button', { name: label, exact: true })).toBeVisible();
    await reader.screenshot({ path: '/private/tmp/schreiber-whiteboard-refresh-retains-data.png', fullPage: true });
    await reader.unroute('**/rest/v1/whiteboard_tiles?*');

    const deleted = writer.waitForResponse(r => new URL(r.url()).pathname === '/rest/v1/whiteboard_tiles' && r.request().method() === 'DELETE');
    await writer.getByRole('button', { name: label, exact: true }).locator('..').getByRole('button', { name: 'Remove', exact: true }).click();
    expect((await deleted).ok()).toBe(true);
    await expect(writer.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    await reader.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(reader.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    await expect(reader.getByRole('alert')).toHaveCount(0);

    const employee = await signIn('employee@example.test');
    await expect(employee.getByText("You don't have access to the planning whiteboard.")).toBeVisible();
    await expect(employee.getByRole('button', { name: 'Task', exact: true })).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    const { error } = await service.from('whiteboard_tiles').delete().eq('label', label);
    expect(error).toBeNull();
  }
});
