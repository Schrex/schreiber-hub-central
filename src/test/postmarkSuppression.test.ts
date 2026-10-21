import { describe, expect, it, vi } from 'vitest'
import { handlePostmarkSuppression, type SuppressionRow } from '../../supabase/functions/_shared/postmark-suppression'

const secret = 'synthetic-webhook-secret-not-a-real-token'
const event = { RecordType: 'SubscriptionChange', ServerID: 123,
  MessageStream: 'outbound', Recipient: 'Synthetic@Example.test',
  ChangedAt: '2026-10-20T12:00:00Z', SuppressSending: true, SuppressionReason: 'HardBounce' }
const options = (suppress = vi.fn(async (_row: SuppressionRow) => {})) => ({
  secret, serverId: '123', stream: 'outbound', suppress,
})
const request = (body: unknown = event, token = secret, method = 'POST') => new Request('https://example.test/hook', {
  method, headers: { 'content-type': 'application/json', 'x-postmark-webhook-secret': token },
  ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
})
describe('Postmark suppression receiver', () => {
  it.each([['HardBounce', 'bounce'], ['SpamComplaint', 'complaint'], ['ManualSuppression', 'unsubscribe']])(
    'maps %s and minimizes metadata', async (providerReason, reason) => {
      const opts = options()
      expect((await handlePostmarkSuppression(request({ ...event, SuppressionReason: providerReason,
        Metadata: { private: 'must not persist' } }), opts)).status).toBe(200)
      expect(opts.suppress).toHaveBeenCalledWith({ email: 'synthetic@example.test', reason,
        metadata: { provider: 'postmark', server_id: 123, message_stream: 'outbound',
          suppression_reason: providerReason, changed_at: event.ChangedAt } })
    })
  it.each(['', 'wrong', 'x'.repeat(1025)])('rejects missing/invalid credential before persistence', async token => {
    const opts = options()
    expect((await handlePostmarkSuppression(request(event, token), opts)).status).toBe(401)
    expect(opts.suppress).not.toHaveBeenCalled()
  })
  it.each([{ secret: undefined }, { secret: 'short' }, { serverId: undefined }, { serverId: '0' }, { stream: undefined }])(
    'fails closed for incomplete configuration %o', async override => {
      const opts = { ...options(), ...override }
      expect((await handlePostmarkSuppression(request(), opts)).status).toBe(503)
      expect(opts.suppress).not.toHaveBeenCalled()
    })
  it.each([{ RecordType: 'Bounce' }, { ServerID: 999 }, { ServerID: '123' },
    { MessageStream: 'broadcast' }, { Recipient: 'bad address@example.test' },
    { ChangedAt: 'invalid' }, { SuppressSending: 'true' }, { SuppressionReason: '__proto__' },
    { SuppressionReason: 'SoftBounce' }])('rejects invalid event %o', async override => {
      const opts = options()
      expect((await handlePostmarkSuppression(request({ ...event, ...override }), opts)).status).toBe(400)
      expect(opts.suppress).not.toHaveBeenCalled()
    })
  it('does not erase local suppression for a provider reactivation', async () => {
    const opts = options()
    const response = await handlePostmarkSuppression(request({ ...event, SuppressSending: false, SuppressionReason: null }), opts)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ result: 'reactivation_ignored' })
    expect(opts.suppress).not.toHaveBeenCalled()
  })
  it('returns retryable failure without leaking database errors', async () => {
    const opts = options(vi.fn(async () => { throw new Error('private database detail') }))
    const response = await handlePostmarkSuppression(request(), opts)
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private')
  })
  it('retries safely after a database failure', async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(undefined)
    const opts = options(persist)
    expect((await handlePostmarkSuppression(request(), opts)).status).toBe(503)
    expect((await handlePostmarkSuppression(request(), opts)).status).toBe(200)
  })
  it('rejects non-POST, malformed JSON, non-JSON and oversized actual bodies', async () => {
    const opts = options()
    expect((await handlePostmarkSuppression(request(undefined, secret, 'GET'), opts)).status).toBe(405)
    const raw = (body: string, contentType = 'application/json') => new Request('https://example.test/hook', {
      method: 'POST', headers: { 'content-type': contentType, 'x-postmark-webhook-secret': secret }, body,
    })
    expect((await handlePostmarkSuppression(raw('{'), opts)).status).toBe(400)
    expect((await handlePostmarkSuppression(raw('{}', 'text/plain'), opts)).status).toBe(415)
    expect((await handlePostmarkSuppression(raw('x'.repeat(16385)), opts)).status).toBe(413)
    expect(opts.suppress).not.toHaveBeenCalled()
  })
})
