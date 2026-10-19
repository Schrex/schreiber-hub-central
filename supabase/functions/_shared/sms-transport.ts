export type SmsResult = { ok: true; sid: string } | { ok: false; reason: string };

type SmsConfig = {
  lovableKey?: string;
  connectorKey?: string;
  fromNumber?: string;
};

/** Existing connector isolated for tests; no provider selection or automatic retry. */
export function createLovableSmsTransport(config: SmsConfig, fetcher: typeof fetch) {
  return {
    async send(to: string, body: string): Promise<SmsResult> {
      if (!config.lovableKey || !config.connectorKey || !config.fromNumber) {
        return { ok: false, reason: 'twilio_not_configured' };
      }
      try {
        const response = await fetcher('https://connector-gateway.lovable.dev/twilio/Messages.json', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.lovableKey}`,
            'X-Connection-Api-Key': config.connectorKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: to, From: config.fromNumber, Body: body }),
        });
        // This reason is persisted in notify_channel. Never persist raw vendor
        // responses or exception messages, which can contain recipient data.
        if (!response.ok) return { ok: false, reason: `sms_http_${response.status}` };
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('sid' in data)
          || typeof data.sid !== 'string' || !data.sid.trim()) {
          return { ok: false, reason: 'sms_invalid_response' };
        }
        return { ok: true, sid: data.sid };
      } catch {
        return { ok: false, reason: 'sms_transport_error' };
      }
    },
  };
}
