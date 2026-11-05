import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../scripts/local-backend.mjs';

// Only synthetic files/rows in the fixed disposable backend. Never use hosted fixtures.
test('private job photo and document open through signed URLs and survive refresh', async ({ browser }, testInfo) => {
  const status = localStatus();
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const id = randomUUID();
  const photoPath = `${id}/browser-photo.png`;
  const contractPath = `${id}/browser-contract.txt`;
  const caption = `Synthetic private photo ${id}`;
  const contractName = `Synthetic contract ${id}.txt`;
  const documentBody = 'Synthetic browser document. No customer or employee data.';
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64');
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:8082' });
  await context.route('**/*', route => ['http://127.0.0.1:8082', 'http://127.0.0.1:55321'].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  try {
    for (const bucket of ['job-photos', 'job-contracts']) {
      const result = await service.storage.getBucket(bucket);
      expect(result.error).toBeNull();
      expect(result.data.public).toBe(false);
    }
    expect((await service.storage.from('job-photos').upload(photoPath, png, { contentType: 'image/png' })).error).toBeNull();
    expect((await service.storage.from('job-contracts').upload(contractPath, Buffer.from(documentBody), { contentType: 'text/plain' })).error).toBeNull();
    expect((await service.from('jobs').insert({ id, name: `Synthetic file browser ${id}`, status: 'active', contract_file_path: contractPath, contract_file_name: contractName })).error).toBeNull();
    expect((await service.from('job_photos').insert({ job_id: id, file_path: photoPath, caption, taken_on: '2026-10-21' })).error).toBeNull();
    const anonymous = await context.request.get(`${status.API_URL}/storage/v1/object/public/job-photos/${photoPath}`);
    expect(anonymous.ok()).toBe(false);

    const page = await context.newPage();
    await page.goto('/auth');
    await expect(page.getByText('Local test environment.', { exact: false })).toBeVisible();
    await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
    await page.getByLabel('Password', { exact: true }).fill('LocalOnly-12345!');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL('http://127.0.0.1:8082/');
    await page.goto(`/jobs/${id}`);
    const photo = page.getByAltText(caption, { exact: true });
    const assertPhoto = async () => {
      await page.getByRole('tab', { name: 'Files' }).click();
      await photo.scrollIntoViewIfNeeded();
      await expect(photo).toBeVisible();
      await expect.poll(() => photo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      const url = new URL(await photo.getAttribute('src'));
      expect(url.origin).toBe(status.API_URL);
      expect(url.pathname).toBe(`/storage/v1/object/sign/job-photos/${photoPath}`);
    };
    await assertPhoto();
    await page.reload();
    await assertPhoto();
    const signing = page.waitForResponse(response => new URL(response.url()).pathname === '/storage/v1/object/sign/job-photos' && response.request().method() === 'POST');
    // Browser lifecycle event, not a direct data fetch: exercise the app's resume handler.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    expect((await signing).ok()).toBe(true);
    await assertPhoto();
    await page.screenshot({ path: testInfo.outputPath('private-photo-after-resume.png') });

    await page.getByRole('tab', { name: 'Job info' }).click();
    const popupPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: contractName, exact: true }).click();
    const document = await popupPromise;
    await document.waitForLoadState('domcontentloaded');
    const documentUrl = new URL(document.url());
    expect(documentUrl.origin).toBe(status.API_URL);
    expect(documentUrl.pathname).toBe(`/storage/v1/object/sign/job-contracts/${contractPath}`);
    await expect(document.locator('body')).toContainText(documentBody);
  } finally {
    await context.close();
    // Delete only this run's randomly identified artifacts, including partial setup.
    const results = await Promise.all([
      service.storage.from('job-photos').remove([photoPath]),
      service.storage.from('job-contracts').remove([contractPath]),
      service.from('job_photos').delete().eq('job_id', id),
    ]);
    const jobDelete = await service.from('jobs').delete().eq('id', id);
    for (const result of [...results, jobDelete]) expect(result.error).toBeNull();
  }
});
