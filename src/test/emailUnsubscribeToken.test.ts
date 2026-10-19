import { describe, expect, it } from 'vitest';
import { readUnsubscribeToken } from '../../supabase/functions/_shared/email-unsubscribe-token';

function request(method = 'GET', query = '', body?: string, contentType?: string) {
  return new Request(`https://example.test/unsubscribe${query}`, {
    method, body, headers: contentType ? { 'content-type': contentType } : undefined,
  });
}

describe('unsubscribe token request compatibility', () => {
  it('reads and decodes the GET query without a body', async () => {
    await expect(readUnsubscribeToken(request('GET', '?token=synthetic%2Btoken'))).resolves.toBe('synthetic+token');
  });
  it('leaves a missing token absent for handler rejection', async () => {
    await expect(readUnsubscribeToken(request())).resolves.toBeNull();
  });
  it('retains the URL token for RFC8058 one-click despite a conflicting form token', async () => {
    await expect(readUnsubscribeToken(request('POST', '?token=url-token', 'List-Unsubscribe=One-Click&token=body-token', 'application/x-www-form-urlencoded'))).resolves.toBe('url-token');
  });
  it('does not substitute the body token for a one-click URL missing its token', async () => {
    await expect(readUnsubscribeToken(request('POST', '', 'List-Unsubscribe=One-Click&token=body-token', 'application/x-www-form-urlencoded'))).resolves.toBeNull();
  });
  it('lets ordinary form submission override query token including content-type charset', async () => {
    await expect(readUnsubscribeToken(request('POST', '?token=url-token', 'token=body-token', 'application/x-www-form-urlencoded; charset=UTF-8'))).resolves.toBe('body-token');
  });
  it('lets JSON submission override query token', async () => {
    await expect(readUnsubscribeToken(request('POST', '?token=url-token', JSON.stringify({ token: 'body-token' }), 'application/json'))).resolves.toBe('body-token');
  });
  it.each(['not-json', '{}', 'null', '{"token":""}'])('retains query token on missing/invalid JSON token %s', async (body) => {
    await expect(readUnsubscribeToken(request('POST', '?token=url-token', body, 'application/json'))).resolves.toBe('url-token');
  });
  it('retains query token on empty form token', async () => {
    await expect(readUnsubscribeToken(request('POST', '?token=url-token', 'token=', 'application/x-www-form-urlencoded'))).resolves.toBe('url-token');
  });
});
