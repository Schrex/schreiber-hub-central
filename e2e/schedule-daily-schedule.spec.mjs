import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../scripts/local-backend.mjs';

// #99: every Schedule link leaves the hub with a real page load to /daily-schedule/ and replaces
// /schedule in history. The Daily Schedule Worker is stubbed; the hub's forwarding is #98.
const status = localStatus();
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const checked = result => { if (result.error) throw result.error; return result.data; };
const base = 'http://127.0.0.1:8082';
const allowed = [base, 'http://127.0.0.1:55321'];
const stub = '<!doctype html><title>Daily Schedule stub</title><h1>Daily Schedule stub</h1>';

async function login(browser, contexts, documents) {
  const context = await browser.newContext({ baseURL: base });
  contexts.push(context);
  await context.route('**/*', route => allowed.includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  // Registered later, so it wins: stands in for the Worker behind /daily-schedule/.
  await context.route(`${base}/daily-schedule/**`, route => {
    documents.push({ url: route.request().url(), navigation: route.request().isNavigationRequest() });
    return route.fulfill({ status: 200, contentType: 'text/html', body: stub });
  });
  const page = await context.newPage();
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill('LocalOnly-12345!');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(`${base}/`);
  return page;
}

// Marks the current document, follows a Schedule link, and checks a new document was loaded.
async function expectDailySchedule(page, documents, follow, backTo) {
  await page.evaluate(() => { window.__hubDocument = true; });
  const before = documents.length;
  await follow();
  await expect(page).toHaveURL(`${base}/daily-schedule/`);
  await expect(page.getByRole('heading', { name: 'Daily Schedule stub' })).toBeVisible();
  expect(documents.slice(before)).toEqual([{ url: `${base}/daily-schedule/`, navigation: true }]);
  expect(await page.evaluate(() => window.__hubDocument)).toBeUndefined();
  await page.goBack();
  await expect(page).toHaveURL(`${base}${backTo}`);
}

test('/schedule and all four Schedule links open the Daily Schedule; Back returns to the hub', async ({ browser }) => {
  const contexts = [], documents = [];
  const job = { id: randomUUID(), name: `Lookahead ${randomUUID().slice(0, 8)}`, status: 'active' };
  checked(await service.from('jobs').insert(job));
  try {
    const page = await login(browser, contexts, documents);

    await expectDailySchedule(page, documents, () => page.goto('/schedule'), '/');

    await page.goto('/');
    await expectDailySchedule(page, documents,
      () => page.getByRole('button').filter({ hasText: 'Today + this week' }).click(), '/');

    await page.goto('/perks');
    await expectDailySchedule(page, documents,
      () => page.locator('nav').getByRole('button', { name: 'Schedule', exact: true }).click(), '/perks');

    await page.goto(`/jobs/${job.id}`);
    await expectDailySchedule(page, documents,
      () => page.getByRole('link', { name: 'Full schedule →' }).click(), `/jobs/${job.id}`);

    // The Whiteboard stays a hub page; only its back button leads to the Daily Schedule.
    await page.goto('/schedule/whiteboard');
    await expect(page.getByRole('button', { name: 'Task', exact: true }).first()).toBeVisible();
    expect(documents.length).toBe(4);
    await expectDailySchedule(page, documents,
      () => page.getByRole('button', { name: 'Back', exact: true }).click(), '/schedule/whiteboard');
  } finally {
    for (const context of contexts) await context.close();
    checked(await service.from('jobs').delete().eq('id', job.id));
  }
});
