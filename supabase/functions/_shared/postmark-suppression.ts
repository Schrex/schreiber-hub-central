// SubscriptionChange covers hard bounces, complaints and manual/unsubscribe
// suppressions. Postmark does not sign webhooks; configure a separate secret in
// its HttpHeaders, never reuse the API token as the webhook secret.
export interface SuppressionRow {
  email: string
  reason: 'bounce' | 'complaint' | 'unsubscribe'
  metadata: Record<string, string | number | null>
}
interface Options {
  secret?: string
  serverId?: string
  stream?: string
  // Must use ON CONFLICT(email) DO NOTHING: retries/out-of-order events cannot
  // erase an earlier unsubscribe or cause duplicate audit-log side effects.
  suppress: (row: SuppressionRow) => Promise<void>
}
const reply = (status: number, result: string) => new Response(JSON.stringify({ result }), {
  status, headers: { 'Content-Type': 'application/json' },
})
async function matchesSecret(actual: string, expected: string): Promise<boolean> {
  const hash = (value: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const [a, b] = await Promise.all([hash(actual), hash(expected)])
  const left = new Uint8Array(a), right = new Uint8Array(b)
  let difference = 0
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i]
  return difference === 0
}
export async function handlePostmarkSuppression(req: Request, options: Options): Promise<Response> {
  if (req.method !== 'POST') return reply(405, 'method_not_allowed')
  if (!options.secret || options.secret.length < 32 || !options.serverId ||
      !/^[1-9]\d*$/.test(options.serverId) || !options.stream) return reply(503, 'not_configured')
  const provided = req.headers.get('x-postmark-webhook-secret') ?? ''
  if (!provided || provided.length > 1024 || !await matchesSecret(provided, options.secret)) {
    return reply(401, 'unauthorized')
  }
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return reply(415, 'json_required')
  }
  // Bound the actual stream, not only the caller-controlled Content-Length.
  let body = ''
  const reader = req.body?.getReader()
  if (!reader) return reply(400, 'invalid_payload')
  const decoder = new TextDecoder()
  let bytes = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > 16384) { await reader.cancel(); return reply(413, 'payload_too_large') }
      body += decoder.decode(chunk.value, { stream: true })
    }
    body += decoder.decode()
  } catch { return reply(400, 'invalid_payload') }
  let event: Record<string, unknown>
  try {
    const parsed = JSON.parse(body)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return reply(400, 'invalid_payload')
    event = parsed
  } catch { return reply(400, 'invalid_payload') }
  // Postmark's Add Webhook UI shows this fixed verification fixture (ServerID 23),
  // even on another server. Authenticate first and acknowledge ONLY this exact
  // fixture without persisting its example address. Never waive real-event scope.
  const metadata = event.Metadata
  if (event.RecordType === 'SubscriptionChange' && event.ServerID === 23 &&
      event.MessageID === '00000000-0000-0000-0000-000000000000' &&
      event.MessageStream === options.stream && event.MessageStream === 'outbound' &&
      event.Recipient === 'john@example.com' && event.Origin === 'Recipient' &&
      event.SuppressSending === true && event.SuppressionReason === 'HardBounce' &&
      event.Tag === 'welcome-email' && typeof event.ChangedAt === 'string' &&
      Number.isFinite(Date.parse(event.ChangedAt)) && metadata !== null &&
      typeof metadata === 'object' && !Array.isArray(metadata) &&
      Object.keys(metadata).length === 2 &&
      (metadata as Record<string, unknown>).example === 'value' &&
      (metadata as Record<string, unknown>).example_2 === 'value') {
    return reply(200, 'verification_ignored')
  }
  if (event.RecordType !== 'SubscriptionChange' ||
      !Number.isSafeInteger(event.ServerID) || String(event.ServerID) !== options.serverId ||
      event.MessageStream !== options.stream || typeof event.SuppressSending !== 'boolean' ||
      typeof event.Recipient !== 'string' || event.Recipient.length > 254 ||
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(event.Recipient) ||
      typeof event.ChangedAt !== 'string' || !Number.isFinite(Date.parse(event.ChangedAt))) {
    return reply(400, 'invalid_payload')
  }
  // Reactivation requires a separate reviewed operator action. Never undo local
  // unsubscribe/complaint suppression because of replay or provider UI changes.
  if (!event.SuppressSending) return reply(200, 'reactivation_ignored')
  const reasons = { HardBounce: 'bounce', SpamComplaint: 'complaint', ManualSuppression: 'unsubscribe' } as const
  if (typeof event.SuppressionReason !== 'string' || !Object.prototype.hasOwnProperty.call(reasons, event.SuppressionReason)) {
    return reply(400, 'invalid_reason')
  }
  const reason = reasons[event.SuppressionReason as keyof typeof reasons]
  try {
    await options.suppress({
      email: event.Recipient.toLowerCase(), reason,
      metadata: { provider: 'postmark', server_id: Number(options.serverId),
        message_stream: options.stream, suppression_reason: event.SuppressionReason,
        changed_at: event.ChangedAt },
    })
  } catch { return reply(503, 'suppression_write_failed') }
  return reply(200, 'suppressed')
}
