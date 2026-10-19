/** Standalone preparation adapter. No environment lookup or deployed-worker selection. */
export interface PostmarkEmail {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  label?: string;
  message_id: string;
  unsubscribe_token?: string;
}
export interface PostmarkOptions {
  serverToken: string;
  messageStream: string;
  /** Exact HTTPS handler URL; reviewed independently of incoming queue payloads. */
  unsubscribeEndpoint?: string;
}
export type PostmarkDeliveryOutcome =
  | { kind: 'accepted'; providerMessageId: string }
  | { kind: 'suppressed' | 'permanent_rejection' | 'configuration_error'; status: number | null; providerCode: number | null; action: 'stop' }
  | { kind: 'rate_limited'; status: 429; providerCode: number | null; action: 'defer'; retryAfterSeconds: number }
  | { kind: 'ambiguous'; status: number | null; providerCode: number | null; action: 'reconcile'; reason: 'network_or_timeout' | 'uncertain_response' };

/** Conservative single-email policy, not a policy for Postmark batch endpoints. */
export function postmarkOutcome(status: number, parsed: unknown, retryAfter: string | null): PostmarkDeliveryOutcome {
  const data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  const code = typeof data.ErrorCode === 'number' && Number.isSafeInteger(data.ErrorCode) && data.ErrorCode >= 0 ? data.ErrorCode : null;
  const sid = typeof data.MessageID === 'string' && data.MessageID.trim() && !/[\r\n]/.test(data.MessageID) ? data.MessageID : null;
  if (status === 200 && code === 0 && sid) return { kind: 'accepted', providerMessageId: sid };
  // Conflicting receipt/rejection or incomplete success cannot justify another send.
  if (sid || code === 0 || status < 400 || status >= 500 || (status === 429 && code !== null)) {
    return { kind: 'ambiguous', status, providerCode: code, action: 'reconcile', reason: 'uncertain_response' };
  }
  if (status === 429) {
    const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 60;
    return { kind: 'rate_limited', status: 429, providerCode: code, action: 'defer',
      retryAfterSeconds: Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 60 };
  }
  if (status === 401 || status === 403 || status === 404 || status === 415
    || (status === 422 && code !== null && [412, 413, 422, 1235, 1236, 1480].includes(code))) {
    return { kind: 'configuration_error', status, providerCode: code, action: 'stop' };
  }
  if (status === 422 && code === 406) return { kind: 'suppressed', status, providerCode: code, action: 'stop' };
  if (status === 413 || (status === 422 && code !== null && [11, 300, 402, 403, 410, 411].includes(code))) {
    return { kind: 'permanent_rejection', status, providerCode: code, action: 'stop' };
  }
  return { kind: 'ambiguous', status, providerCode: code, action: 'reconcile', reason: 'uncertain_response' };
}

export function postmarkPayload(message: PostmarkEmail, options: PostmarkOptions) {
  for (const value of [message.from, message.to, message.subject, message.message_id, options.messageStream]) {
    if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value)) throw new Error('Invalid Postmark message configuration');
  }
  if (!message.html && !message.text) throw new Error('Email body required');
  const headers: { Name: string; Value: string }[] = [];
  if (message.unsubscribe_token) {
    if (!options.unsubscribeEndpoint) throw new Error('Unsubscribe endpoint required');
    const endpoint = new URL(options.unsubscribeEndpoint);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash) throw new Error('Invalid unsubscribe endpoint');
    endpoint.searchParams.set('token', message.unsubscribe_token);
    headers.push({ Name: 'List-Unsubscribe', Value: `<${endpoint.href}>` });
    headers.push({ Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' });
  }
  return {
    From: message.from, To: message.to, Subject: message.subject,
    ...(message.html ? { HtmlBody: message.html } : {}),
    ...(message.text ? { TextBody: message.text } : {}),
    ...(message.label ? { Tag: message.label } : {}),
    MessageStream: options.messageStream,
    Metadata: { application_message_id: message.message_id },
    Headers: headers,
    TrackOpens: false,
    TrackLinks: 'None',
  };
}

/** Explicit injected HTTP client is mandatory; tests supply a fake, never fetch. */
export function createPostmarkAdapter(options: PostmarkOptions, request: typeof fetch) {
  if (!options.serverToken.trim() || /[\r\n]/.test(options.serverToken)) throw new Error('Postmark server token required');
  return {
    // Intentionally not the worker's send(): Promise<void> contract. A consumer must
    // persist and act on the outcome rather than feed it into generic retry logic.
    async deliver(message: PostmarkEmail): Promise<PostmarkDeliveryOutcome> {
      let body: string;
      try { body = JSON.stringify(postmarkPayload(message, options)); } catch {
        return { kind: 'configuration_error', status: null, providerCode: null, action: 'stop' };
      }
      let response: Response;
      try {
        response = await request('https://api.postmarkapp.com/email', {
          method: 'POST', redirect: 'error',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Postmark-Server-Token': options.serverToken },
          body,
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        return { kind: 'ambiguous', status: null, providerCode: null, action: 'reconcile', reason: 'network_or_timeout' };
      }
      let parsed: unknown;
      try { parsed = await response.json(); } catch { parsed = null; }
      return postmarkOutcome(response.status, parsed, response.headers.get('retry-after'));
    },
  };
}
