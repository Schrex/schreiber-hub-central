// Published Cobblestone task grid (J2607) on the local synthetic backend.
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../scripts/local-backend.mjs';

const PASSWORD = 'LocalOnly-12345!';

function publishShot(source, name) {
  try {
    const destDir = '/opt/cursor/artifacts';
    mkdirSync(destDir, { recursive: true });
    copyFileSync(source, path.join(destDir, name));
  } catch {
    // Hosted CI has no artifact mount. The Playwright output file still exists.
  }
}

test('Seeded Cobblestone look-ahead grid', async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const status = localStatus();
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const checked = (result) => { if (result.error) throw result.error; return result.data; };
  const run = randomUUID().slice(0, 8);
  const otherId = randomUUID();
  const contexts = [];

  const shot = async (page, name) => {
    const file = testInfo.outputPath(name);
    await page.screenshot({ path: file, fullPage: true });
    publishShot(file, name);
  };
  const cell = (page, task, date) => page.locator(`[data-testid="lookahead-cell"][data-task="${task}"][data-date="${date}"]`);

  try {
    const job = checked(await service.from('jobs').select('id, name, job_number').eq('job_number', 'J2607').single());
    checked(await service.from('jobs').insert({
      id: otherId,
      name: `Unflagged lookahead ${run}`,
      status: 'active',
      lookahead_grid_enabled: false,
    }));

    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:8082',
      viewport: { width: 375, height: 812 },
    });
    contexts.push(context);
    await context.route('**/*', (route) => {
      const origin = new URL(route.request().url()).origin;
      return ['http://127.0.0.1:8082', 'http://127.0.0.1:55321'].includes(origin) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    await page.goto('/auth');
    await page.getByLabel('Email', { exact: true }).fill('employee@example.test');
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL('http://127.0.0.1:8082/');

    await page.goto(`/jobs/${job.id}`);
    await expect(page.getByRole('heading', { name: job.name, level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Look-ahead' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: /^This week/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Next 3 weeks/ })).toBeVisible();
    await expect(page.getByTestId('lookahead-grid')).toContainText('Published');
    await expect(page.getByRole('button', { name: 'Upload look-ahead' })).toHaveCount(0);
    await expect(page.getByTestId('lookahead-group').filter({ hasText: 'Grading/Dirt work' })).toBeVisible();
    await expect(page.getByTestId('lookahead-group').filter({ hasText: 'Water' })).toBeVisible();
    await expect(page.getByTestId('lookahead-who').first()).toContainText('Schreiber');
    await expect(cell(page, 'Strip Topsoil', '2026-11-09')).toHaveText('X');
    await expect(cell(page, 'Strip Topsoil', '2026-11-10')).toHaveText('');
    await expect(cell(page, 'Hot Box', '2026-11-20')).toHaveText('X');
    await expect(cell(page, 'Hot Box', '2026-11-23')).toHaveText('X');
    await expect(cell(page, 'Hot Box', '2026-11-24')).toHaveText('X');
    await expect(cell(page, 'Hot Box', '2026-11-25')).toHaveText('X');
    await expect(cell(page, 'Hot Box', '2026-11-26')).toHaveText('HOL');
    await expect(cell(page, 'Hot Box', '2026-11-27')).toHaveText('HOL');
    await expect(page.getByTestId('lookahead-grid')).not.toContainText('Respread');
    await expect(page.getByTestId('lookahead-grid')).not.toContainText('Curbs');
    await expect(page.getByTestId('lookahead-grid')).not.toContainText('$');
    await expect(page.getByRole('heading', { name: '3-Week Lookahead' })).toBeVisible();

    await page.getByRole('tab', { name: 'Job info' }).click();
    await expect(page.getByRole('heading', { name: 'Scope of work' })).toBeVisible();
    await page.getByRole('tab', { name: 'Files' }).click();
    await expect(page.getByRole('heading', { name: 'Files', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Field' }).click();
    await expect(page.getByRole('heading', { name: '811 Dig Tickets' })).toBeVisible();
    await page.getByRole('tab', { name: 'Look-ahead' }).click();
    await expect(page.getByTestId('lookahead-grid')).toBeVisible();

    await page.getByTestId('lookahead-scroll').evaluate((node) => { node.scrollLeft = node.scrollWidth; });
    await shot(page, 'cobblestone-lookahead-phone.png');

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId('lookahead-scroll').evaluate((node) => { node.scrollLeft = 0; });
    await expect(cell(page, 'Hot Box', '2026-11-26')).toBeVisible();
    await shot(page, 'cobblestone-lookahead-desktop.png');

    await page.goto(`/jobs/${otherId}`);
    await expect(page.getByRole('heading', { name: `Unflagged lookahead ${run}`, level: 1 })).toBeVisible();
    await expect(page.getByTestId('job-detail-tabs')).toHaveCount(0);
    await expect(page.getByTestId('lookahead-grid')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '3-Week Lookahead' })).toBeVisible();
  } finally {
    for (const context of contexts) await context.close();
    await service.from('jobs').delete().eq('id', otherId);
  }
});
