// Office/admin XML upload → preview → publish on any job. The MSPDI fixture is synthetic.
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../scripts/local-backend.mjs';

const PASSWORD = 'LocalOnly-12345!';
const XML = fileURLToPath(new URL('./fixtures/cobblestone.mspdi.xml', import.meta.url));

function publishShot(source, name) {
  try {
    const destDir = '/opt/cursor/artifacts';
    mkdirSync(destDir, { recursive: true });
    copyFileSync(source, path.join(destDir, name));
  } catch {
    // Hosted CI has no artifact mount. The Playwright output file still exists.
  }
}

test('Admin uploads, previews, and publishes a look-ahead', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const status = localStatus();
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const checked = (result) => { if (result.error) throw result.error; return result.data; };
  const run = randomUUID().slice(0, 8);
  const jobId = randomUUID();
  const jobName = `XML upload ${run}`;
  const contexts = [];
  const cell = (page, task, date) => page.locator(`[data-testid="lookahead-grid"] [data-testid="lookahead-cell"][data-task="${task}"][data-date="${date}"]`);
  const shot = async (page, name) => {
    const file = testInfo.outputPath(name);
    await page.screenshot({ path: file, fullPage: true });
    publishShot(file, name);
  };

  try {
    checked(await service.from('jobs').insert({
      id: jobId, name: jobName, status: 'active', lookahead_grid_enabled: false,
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
    await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL('http://127.0.0.1:8082/');

    await page.goto(`/jobs/${jobId}`);
    await page.getByRole('tab', { name: 'Look-ahead' }).click();
    await expect(page.getByRole('button', { name: 'Upload look-ahead' })).toBeVisible();
    await expect(page.getByText('No published look-ahead for this job.')).toBeVisible();

    await page.getByLabel('Look-ahead XML file').setInputFiles(XML);

    const preview = page.getByTestId('lookahead-preview');
    await expect(preview).toBeVisible();
    await expect(preview.getByRole('heading', { name: /^This week/ })).toBeVisible();
    await expect(preview.getByRole('heading', { name: /^Next 3 weeks/ })).toBeVisible();
    await expect(preview.locator('[data-testid="lookahead-cell"][data-task="Hot Box"][data-date="2026-11-25"]')).toHaveText('X');
    await expect(preview.locator('[data-testid="lookahead-cell"][data-task="Hot Box"][data-date="2026-11-26"]')).toHaveText('HOL');
    await expect(preview).not.toContainText('987654.32');
    await expect(preview).not.toContainText('Curbs');

    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('Look-ahead published.')).toBeVisible();
    await expect(preview).toHaveCount(0);
    await expect(page.getByTestId('lookahead-grid')).toBeVisible();
    await expect(cell(page, 'Inlet protection', '2026-11-02')).toHaveText('X');
    await expect(cell(page, 'Hot Box', '2026-11-23')).toHaveText('X');
    await expect(cell(page, 'Hot Box', '2026-11-26')).toHaveText('HOL');
    await expect(cell(page, 'Hot Box', '2026-11-27')).toHaveText('HOL');
    expect(checked(await service.from('jobs').select('lookahead_grid_enabled').eq('id', jobId).single()).lookahead_grid_enabled).toBe(true);
    const plans = checked(await service.from('lookahead_plans').select('id, status, published_by, source').eq('job_id', jobId));
    expect(plans).toHaveLength(1);
    expect(plans[0].status).toBe('published');
    expect(plans[0].source).toBe('mspdi_xml');
    expect(plans[0].published_by).toBeTruthy();

    await page.getByTestId('lookahead-scroll').evaluate((node) => { node.scrollLeft = node.scrollWidth; });
    await shot(page, 'lookahead-upload-phone.png');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId('lookahead-scroll').evaluate((node) => { node.scrollLeft = 0; });
    await expect(cell(page, 'Hot Box', '2026-11-26')).toBeVisible();
    await shot(page, 'lookahead-upload-desktop.png');

    const employeeContext = await browser.newContext({ baseURL: 'http://127.0.0.1:8082', viewport: { width: 1280, height: 900 } });
    contexts.push(employeeContext);
    await employeeContext.route('**/*', (route) => {
      const origin = new URL(route.request().url()).origin;
      return ['http://127.0.0.1:8082', 'http://127.0.0.1:55321'].includes(origin) ? route.continue() : route.abort();
    });
    const employee = await employeeContext.newPage();
    await employee.goto('/auth');
    await employee.getByLabel('Email', { exact: true }).fill('employee@example.test');
    await employee.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await employee.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(employee).toHaveURL('http://127.0.0.1:8082/');
    await employee.goto(`/jobs/${jobId}`);
    await expect(employee.getByTestId('lookahead-grid')).toBeVisible();
    await expect(employee.getByRole('button', { name: 'Upload look-ahead' })).toHaveCount(0);
    await expect(cell(employee, 'Hot Box', '2026-11-25')).toHaveText('X');
  } finally {
    for (const context of contexts) await context.close();
    await service.from('jobs').delete().eq('id', jobId);
  }
});
