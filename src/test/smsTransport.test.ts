import { describe, expect, it, vi } from 'vitest';
import { createLovableSmsTransport } from '../../supabase/functions/_shared/sms-transport';

const config = { lovableKey: 'fake-lovable', connectorKey: 'fake-connector', fromNumber: '+12025550100' };
const recipient = '+12025550101';
const body = 'Synthetic talk & quiz: https://example.test/safety/take/fake-token';

describe('SMS transport boundary (fake fetch only)', () => {
  it('encodes the existing connector payload and returns its accepted message id', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ sid: 'synthetic-id' })));
    const result = await createLovableSmsTransport(config, fetcher).send(recipient, body);
    expect(result).toEqual({ ok: true, sid: 'synthetic-id' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('https://connector-gateway.lovable.dev/twilio/Messages.json');
    expect(request?.method).toBe('POST');
    expect(request?.headers).toEqual({ Authorization: 'Bearer fake-lovable', 'X-Connection-Api-Key': 'fake-connector', 'Content-Type': 'application/x-www-form-urlencoded' });
    const params = new URLSearchParams(String(request?.body));
    expect(Object.fromEntries(params)).toEqual({ To: recipient, From: config.fromNumber, Body: body });
  });

  it.each(['lovableKey', 'connectorKey', 'fromNumber'] as const)('fails without network when %s is missing', async key => {
    const fetcher = vi.fn<typeof fetch>();
    expect(await createLovableSmsTransport({ ...config, [key]: undefined }, fetcher).send(recipient, body))
      .toEqual({ ok: false, reason: 'twilio_not_configured' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([401, 429, 500])('reports HTTP %s without storing vendor detail or retrying', async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('private recipient and credential detail', { status }));
    expect(await createLovableSmsTransport(config, fetcher).send(recipient, body))
      .toEqual({ ok: false, reason: `sms_http_${status}` });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([{}, { sid: '' }, { sid: 12 }, null])('does not claim SMS success for malformed response %j', async data => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(data)));
    expect(await createLovableSmsTransport(config, fetcher).send(recipient, body))
      .toEqual({ ok: false, reason: 'sms_invalid_response' });
  });

  it('contains unreadable responses and network errors without retrying', async () => {
    for (const failure of [false, true]) {
      const fetcher = vi.fn<typeof fetch>();
      if (failure) fetcher.mockRejectedValue(new Error('private request detail'));
      else fetcher.mockResolvedValue(new Response('not-json'));
      expect(await createLovableSmsTransport(config, fetcher).send(recipient, body))
        .toEqual({ ok: false, reason: 'sms_transport_error' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
});
