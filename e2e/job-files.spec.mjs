import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../scripts/local-backend.mjs';

test('job Files shows private signed attachments and preserves contract visibility', async ({ browser }, testInfo) => {
  const status = localStatus();
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const id = randomUUID();
  const paths = [`${id}/current.txt`, `${id}/old.txt`, `${id}/contract.txt`];
  const contexts = [];
  let foremanId;
  const foremanEmail = `files-${id}@example.test`;
  const checked = result => { if (result.error) throw result.error; return result.data; };
  async function login(email) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:8082', acceptDownloads: true });
    contexts.push(context);
    await context.route('**/*', route => ['http://127.0.0.1:8082', 'http://127.0.0.1:55321'].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto('/auth');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('LocalOnly-12345!');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL('http://127.0.0.1:8082/');
    await page.goto(`/jobs/${id}`);
    return page;
  }
  try {
    const created = checked(await service.auth.admin.createUser({ email: foremanEmail, password: 'LocalOnly-12345!', email_confirm: true }));
    foremanId = created.user.id;
    checked(await service.from('user_roles').insert({ user_id: foremanId, role: 'foreman' }));
    checked(await service.from('jobs').insert({ id, name: `Synthetic Files ${id}`, status: 'active', contract_file_path: paths[2], contract_file_name: 'Private contract.txt' }));
    for (let i = 0; i < paths.length; i++) checked(await service.storage.from(i === 2 ? 'job-contracts' : 'job-plans').upload(paths[i], new Blob(['Synthetic file only'], { type: 'text/plain' })));
    checked(await service.from('job_plans').insert([
      { job_id: id, title: 'Synthetic plan', category: 'civil', file_path: paths[0], version: '2', is_current: true },
      { job_id: id, title: 'Synthetic plan', category: 'civil', file_path: paths[1], version: '1', is_current: false },
    ]));
    const employee = await login('employee@example.test');
    const list = employee.getByRole('region', { name: 'Job files' });
    await expect(list.getByText('current.txt', { exact: true })).toBeVisible();
    await expect(list.getByText(/Previous version/)).toBeVisible();
    await expect(list.getByText('Private contract.txt', { exact: true })).toHaveCount(0);
    const downloadEvent = employee.waitForEvent('download');
    await list.getByRole('button', { name: 'Download current.txt', exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('current.txt');
    expect(await download.failure()).toBeNull();
    const popupEvent = employee.waitForEvent('popup');
    await list.getByRole('button', { name: 'Open old.txt', exact: true }).click();
    const popup = await popupEvent;
    await expect(popup).toHaveURL(/127\.0\.0\.1:55321\/storage\/v1\/object\/sign\/job-plans\//);
    await expect(popup.locator('body')).toContainText('Synthetic file only');
    await popup.close();
    const foreman = await login(foremanEmail);
    await expect(foreman.getByRole('region', { name: 'Job files' }).getByText('current.txt', { exact: true })).toBeVisible();
    await expect(foreman.getByRole('region', { name: 'Job files' }).getByText('Private contract.txt', { exact: true })).toHaveCount(0);
    await foreman.setViewportSize({ width: 390, height: 844 });
    await foreman.getByRole('region', { name: 'Job files' }).screenshot({ path: testInfo.outputPath('job-files-mobile.png') });
    const admin = await login('admin@example.test');
    await expect(admin.getByRole('region', { name: 'Job files' }).getByText('Private contract.txt', { exact: true })).toBeVisible();
  } finally {
    for (const context of contexts) await context.close();
    checked(await service.from('job_plans').delete().eq('job_id', id));
    checked(await service.storage.from('job-plans').remove(paths.slice(0, 2)));
    checked(await service.storage.from('job-contracts').remove([paths[2]]));
    checked(await service.from('jobs').delete().eq('id', id));
    if (foremanId) checked(await service.auth.admin.deleteUser(foremanId));
  }
});
