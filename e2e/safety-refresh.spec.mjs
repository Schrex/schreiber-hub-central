import { test, expect } from '@playwright/test';

test('Safety uses permitted attendee columns and retains sign-offs when refresh fails', async ({ browser }) => {
  // Synthetic HTTP fixtures test the UI failure path; this is not hosted RLS proof.
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:8082' });
  try {
    await context.route('**/*', route => ['http://127.0.0.1:8082', 'http://127.0.0.1:55321'].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto('/auth');
    await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
    await page.getByLabel('Password', { exact: true }).fill('LocalOnly-12345!');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL('http://127.0.0.1:8082/');
    const json = data => ({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    await page.route('**/rest/v1/toolbox_talks?*', route => route.fulfill(json([{ id: 'synthetic-talk', title: 'Synthetic refresh proof', content: 'Fabricated safety talk.', quiz_questions: [], is_active: true }])));
    await page.route('**/rest/v1/toolbox_talk_sessions?*', route => route.fulfill(json([{ id: 'synthetic-session', talk_id: 'synthetic-talk', foreman_id: 'synthetic-foreman', status: 'in_progress', started_at: new Date().toISOString() }])));
    let fail = false;
    let attendeeReads = 0;
    await page.route('**/rest/v1/toolbox_talk_attendees?*', route => {
      const select = new URL(route.request().url()).searchParams.get('select');
      expect(select).not.toContain('*');
      expect(select).not.toContain('access_token');
      attendeeReads++;
      return route.fulfill(fail ? { status: 403, contentType: 'application/json', body: '{"message":"Synthetic permission failure"}' } : json([{ id: 'synthetic-attendee', session_id: 'synthetic-session', attendee_name: 'Fabricated crew member', signed_at: '2026-10-20T12:00:00Z', quiz_score: null, quiz_total: null }]));
    });
    await page.goto('/safety');
    await page.getByRole('tab', { name: 'Sessions', exact: true }).click();
    await page.getByRole('button', { name: /Synthetic refresh proof/ }).click();
    await page.getByRole('button', { name: /Crew quiz/ }).click();
    await expect(page.getByText('Fabricated crew member', { exact: true })).toBeVisible();
    fail = true;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.getByRole('alert')).toContainText('Could not refresh attendees');
    await expect(page.getByText('Fabricated crew member', { exact: true })).toBeVisible();
    fail = false;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(attendeeReads).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: '/private/tmp/schreiber-safety-refresh-proof.png', fullPage: true });
  } finally { await context.close(); }
});
