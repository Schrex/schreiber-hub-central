import { describe, expect, it, vi } from 'vitest';
import { createPostmarkAdapter, postmarkPayload } from '../../supabase/functions/_shared/postmark-email';
const options = { serverToken: 'synthetic-only-token', messageStream: 'outbound', unsubscribeEndpoint: 'https://example.test/functions/unsubscribe' };
const message = { from: 'sender@example.test', to: 'employee@example.test', subject: 'Synthetic', text: 'Text', html: '<p>Text</p>', message_id: 'synthetic-id', label: 'test', unsubscribe_token: 'synthetic+token' };
const response = (status: number, body: unknown, headers = {}) => new Response(JSON.stringify(body), { status, headers });

describe('standalone Postmark preparation adapter', () => {
  it('maps content, stream, tracking policy and one-click headers without inventing idempotency', () => {
    const payload = postmarkPayload(message, options);
    expect(payload).toMatchObject({ From: message.from, To: message.to, Subject: message.subject, HtmlBody: message.html, TextBody: message.text, MessageStream: 'outbound', Metadata: { app_message_id: 'synthetic-id' }, TrackOpens: false, TrackLinks: 'None' });
    expect(payload.Headers).toEqual([{ Name: 'List-Unsubscribe', Value: '<https://example.test/functions/unsubscribe?token=synthetic%2Btoken>' }, { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' }]);
    expect(JSON.stringify(payload)).not.toMatch(/idempotency/i);
  });
  it('omits unsubscribe headers when the caller does not supply a token', () => {
    expect(postmarkPayload({ ...message, unsubscribe_token: undefined }, options).Headers).toEqual([]);
  });
  it('requires explicit stream and a safe endpoint when carrying an unsubscribe token', () => {
    expect(() => postmarkPayload(message, { ...options, messageStream: '' })).toThrow();
    expect(() => postmarkPayload(message, { ...options, unsubscribeEndpoint: undefined })).toThrow();
    expect(() => postmarkPayload(message, { ...options, unsubscribeEndpoint: 'http://example.test' })).toThrow();
  });
  it('sends one request and returns provider ID for future persistence', async () => {
    const fake = vi.fn<typeof fetch>().mockResolvedValue(response(200, { ErrorCode: 0, MessageID: 'provider-synthetic-id' }));
    await expect(createPostmarkAdapter(options, fake).deliver(message)).resolves.toEqual({ kind: 'accepted', providerMessageId: 'provider-synthetic-id' });
    expect(fake).toHaveBeenCalledTimes(1);
    const [url, init] = fake.mock.calls[0];
    expect(url).toBe('https://api.postmarkapp.com/email');
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', headers: { 'X-Postmark-Server-Token': 'synthetic-only-token' } });
  });
  it.each([
    [422, 403, 'permanent_rejection'], [422, 406, 'suppressed'],
    [401, 10, 'configuration_error'], [422, 413, 'configuration_error'],
    [422, 1235, 'configuration_error'], [422, 300, 'permanent_rejection'],
    [413, null, 'permanent_rejection'], [403, null, 'configuration_error'],
  ])('classifies HTTP %s code %s as %s without retry', async (status, code, kind) => {
    const fake = vi.fn<typeof fetch>().mockResolvedValue(response(Number(status), { ErrorCode: code, Message: 'private recipient' }));
    const outcome = await createPostmarkAdapter(options, fake).deliver(message);
    expect(outcome).toEqual({ kind, status, providerCode: code, action: 'stop' });
    expect(JSON.stringify(outcome)).not.toContain('private');
    expect(fake).toHaveBeenCalledTimes(1);
  });
  it.each([['90', 90], ['0', 60], ['-1', 60], ['junk', 60], ['99999999999999999999999', 60], ['Wed, 21 Oct 2026 07:28:00 GMT', 60]])('defers explicit rate limits with delay %s', async (header, seconds) => {
    const fake = vi.fn<typeof fetch>().mockResolvedValue(response(429, {}, { 'retry-after': header }));
    expect(await createPostmarkAdapter(options, fake).deliver(message)).toEqual({ kind: 'rate_limited', status: 429, providerCode: null, action: 'defer', retryAfterSeconds: seconds });
    expect(fake).toHaveBeenCalledTimes(1);
  });
  it.each([
    [200, { ErrorCode: 406 }], [200, { ErrorCode: 0 }], [200, {}],
    [200, { ErrorCode: 0, MessageID: ' ' }], [200, { ErrorCode: '0', MessageID: 'id' }],
    [200, { ErrorCode: 0, MessageID: 'id\nsecret' }],
    [422, { ErrorCode: 0, MessageID: 'id' }], [429, { ErrorCode: 0 }],
    [429, { ErrorCode: 406 }],
    [500, { ErrorCode: 101 }], [503, { ErrorCode: 100 }],
    [422, { ErrorCode: 99999 }], [408, {}], [422, { ErrorCode: -1 }],
  ])('holds uncertain HTTP %s response %j for reconciliation', async (status, data) => {
    const fake = vi.fn<typeof fetch>().mockResolvedValue(response(status as number, data));
    const outcome = await createPostmarkAdapter(options, fake).deliver(message);
    expect(outcome).toMatchObject({ kind: 'ambiguous', action: 'reconcile', status });
    expect(outcome).not.toHaveProperty('retryAfterSeconds');
    expect(fake).toHaveBeenCalledTimes(1);
  });
  it('holds invalid JSON success and network timeouts without synthetic retry statuses', async () => {
    for (const network of [false, true]) {
      const fake = vi.fn<typeof fetch>();
      if (network) fake.mockRejectedValue(new Error('private payload'));
      else fake.mockResolvedValue(new Response('invalid JSON', { status: 200 }));
      const outcome = await createPostmarkAdapter(options, fake).deliver(message);
      expect(outcome).toMatchObject({ kind: 'ambiguous', action: 'reconcile', status: network ? null : 200 });
      expect(outcome).not.toHaveProperty('retryAfterSeconds');
      expect(JSON.stringify(outcome)).not.toContain('private');
      expect(fake).toHaveBeenCalledTimes(1);
    }
  });
  it('rejects local configuration before any HTTP request and exposes no generic send method', async () => {
    const fake = vi.fn<typeof fetch>();
    const adapter = createPostmarkAdapter(options, fake);
    expect(adapter).not.toHaveProperty('send');
    expect(await adapter.deliver({ ...message, subject: '' })).toEqual({ kind: 'configuration_error', status: null, providerCode: null, action: 'stop' });
    expect(fake).not.toHaveBeenCalled();
  });
});
