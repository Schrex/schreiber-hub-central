import { createPostmarkAdapter } from '../_shared/postmark-email.ts'
import { sendLovableEmail } from 'npm:@lovable.dev/email-js'
import { createClient } from 'npm:@supabase/supabase-js@2'

const MAX_RETRIES = 5
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_SEND_DELAY_MS = 200
const DEFAULT_AUTH_TTL_MINUTES = 15
const DEFAULT_TRANSACTIONAL_TTL_MINUTES = 60

// Check if an error is a rate-limit (429) response.
// Uses EmailAPIError.status when available (email-js >=0.x with structured errors),
// falls back to parsing the error message for older versions.
function isRateLimited(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 429
  }
  return error instanceof Error && error.message.includes('429')
}

// Check if an error is a forbidden (403) response, which means emails are
// disabled for this project. Retrying won't help — move straight to DLQ.
function isForbidden(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 403
  }
  return error instanceof Error && error.message.includes('403')
}

// Extract Retry-After seconds from a structured EmailAPIError, or default to 60s.
function getRetryAfterSeconds(error: unknown): number {
  if (error && typeof error === 'object' && 'retryAfterSeconds' in error) {
    return (error as { retryAfterSeconds: number | null }).retryAfterSeconds ?? 60
  }
  return 60
}

// Database failures are not provider send failures and must never consume the
// provider retry budget or report a healthy dispatcher run.
class QueueOperationError extends Error {}
async function checked<T extends { error: unknown }>(operation: PromiseLike<T>): Promise<T> {
  const result = await Promise.resolve(operation).catch(() => {
    throw new QueueOperationError('Email queue database request failed')
  })
  if (result.error) throw new QueueOperationError('Email queue database operation failed')
  return result
}

const queueClient = (url: string, key: string) => createClient(url, key)

// Move a message to the dead letter queue and log the reason.
async function moveToDlq(
  supabase: ReturnType<typeof queueClient>,
  queue: string,
  msg: { msg_id: number; message: Record<string, unknown> },
  reason: string
): Promise<void> {
  const payload = msg.message
  await checked(supabase.from('email_send_log').insert({
    message_id: payload.message_id,
    template_name: (payload.label || queue) as string,
    recipient_email: payload.to,
    status: 'dlq',
    error_message: reason,
  }))
  await checked(supabase.rpc('move_to_dlq', {
    source_queue: queue,
    dlq_name: `${queue}_dlq`,
    message_id: msg.msg_id,
    payload,
  }))
}

async function processQueue(req: Request): Promise<Response> {
  const provider = Deno.env.get('EMAIL_PROVIDER') ?? 'lovable'
  const apiKey = Deno.env.get(provider === 'postmark' ? 'POSTMARK_SERVER_TOKEN' : 'LOVABLE_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const workerAuthToken = Deno.env.get('EMAIL_WORKER_AUTH_TOKEN') ?? supabaseServiceKey

  if (!['lovable', 'postmark'].includes(provider) || !apiKey || !supabaseUrl || !supabaseServiceKey || !workerAuthToken) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // The dispatcher credential can differ from the platform-injected DB key.
  // An explicit override replaces the fallback; never trust unsigned JWT claims.
  // Keep verify_jwt=true and provision a valid project service-role JWT for callers.
  const token = authHeader.slice('Bearer '.length).trim()
  if (token !== workerAuthToken) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  // No queue claims or log writes while delivery is disabled.
  if (provider === 'postmark' && Deno.env.get('EMAIL_DELIVERY_ENABLED') !== 'true') {
    return new Response(JSON.stringify({ skipped: true, reason: 'delivery_disabled' }),
      { headers: { 'Content-Type': 'application/json' } })
  }
  const postmark = provider === 'postmark' ? createPostmarkAdapter({
    serverToken: apiKey,
    messageStream: Deno.env.get('POSTMARK_MESSAGE_STREAM') ?? 'outbound',
    unsubscribeEndpoint: `${supabaseUrl}/functions/v1/handle-email-unsubscribe`,
  }, fetch) : null
  const postmarkFrom = Deno.env.get('POSTMARK_FROM')
  if (postmark && !postmarkFrom) {
    return new Response(JSON.stringify({ error: 'Postmark sender required' }), { status: 500 })
  }
  // Default to controlled delivery; production fan-out requires an explicit mode.
  const deliveryMode = Deno.env.get('EMAIL_DELIVERY_MODE') ?? 'controlled'
  const allowedRecipients = new Set((Deno.env.get('EMAIL_ALLOWED_RECIPIENTS') ?? '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean))
  if (!['controlled', 'production'].includes(deliveryMode) ||
      (deliveryMode === 'controlled' && allowedRecipients.size === 0)) {
    return new Response(JSON.stringify({ error: 'Controlled recipient configuration required' }), { status: 503 })
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Check rate-limit cooldown and read queue config
  const { data: state } = await checked(supabase
    .from('email_send_state')
    .select('retry_after_until, batch_size, send_delay_ms, auth_email_ttl_minutes, transactional_email_ttl_minutes')
    .single())

  if (state?.retry_after_until && new Date(state.retry_after_until) > new Date()) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'rate_limited' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  const batchSize = state?.batch_size ?? DEFAULT_BATCH_SIZE
  const sendDelayMs = state?.send_delay_ms ?? DEFAULT_SEND_DELAY_MS
  const ttlMinutes: Record<string, number> = {
    auth_emails: state?.auth_email_ttl_minutes ?? DEFAULT_AUTH_TTL_MINUTES,
    transactional_emails: state?.transactional_email_ttl_minutes ?? DEFAULT_TRANSACTIONAL_TTL_MINUTES,
  }

  let totalProcessed = 0
  let sendFailures = 0

  // 2. Process auth_emails first (priority), then transactional_emails
  for (const queue of (postmark ? ['transactional_emails'] : ['auth_emails', 'transactional_emails'])) {
    const { data: messages } = await checked(supabase.rpc('read_email_batch', {
      queue_name: queue,
      batch_size: batchSize,
      vt: 30,
    }))

    if (!messages?.length) continue

    // Retry budget is based on real send failures, not pgmq read_ct.
    // read_ct increments for every message in a claimed batch, including
    // messages not attempted when a 429 stops processing early.
    const messageIds = Array.from(
      new Set(
        messages
          .map((msg: { message?: { message_id?: unknown } }) =>
            msg?.message?.message_id && typeof msg.message.message_id === 'string'
              ? msg.message.message_id
              : null
          )
          .filter((id: unknown): id is string => Boolean(id))
      )
    )
    const failedAttemptsByMessageId = new Map<string, number>()
    if (messageIds.length > 0) {
      const { data: failedRows } = await checked(supabase
        .from('email_send_log')
        .select('message_id')
        .in('message_id', messageIds)
        .eq('status', 'failed'))

      for (const row of failedRows ?? []) {
        const messageId = row?.message_id
        if (typeof messageId !== 'string' || !messageId) continue
        failedAttemptsByMessageId.set(
          messageId,
          (failedAttemptsByMessageId.get(messageId) ?? 0) + 1
        )
      }
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const payload = msg.message
      // Never delete, DLQ, redirect or mark unapproved recipients delivered.
      if (deliveryMode === 'controlled' &&
          (typeof payload?.to !== 'string' || !allowedRecipients.has(payload.to.trim().toLowerCase()))) continue
      const failedAttempts =
        payload?.message_id && typeof payload.message_id === 'string'
          ? (failedAttemptsByMessageId.get(payload.message_id) ?? 0)
          : msg.read_ct ?? 0

      // Drop expired messages (TTL exceeded).
      // Prefer payload.queued_at when present; fall back to PGMQ's enqueued_at
      // which is always set by the queue.
      const queuedAt = payload.queued_at ?? msg.enqueued_at
      if (queuedAt) {
        const ageMs = Date.now() - new Date(queuedAt).getTime()
        const maxAgeMs = ttlMinutes[queue] * 60 * 1000
        if (ageMs > maxAgeMs) {
          console.warn('Email expired (TTL exceeded)', {
            queue,
            msg_id: msg.msg_id,
            queued_at: queuedAt,
            ttl_minutes: ttlMinutes[queue],
          })
          await moveToDlq(supabase, queue, msg, `TTL exceeded (${ttlMinutes[queue]} minutes)`)
          continue
        }
      }

      // Move to DLQ if max failed send attempts reached.
      if (failedAttempts >= MAX_RETRIES) {
        await moveToDlq(supabase, queue, msg, `Max retries (${MAX_RETRIES}) exceeded (attempted ${failedAttempts} times)`)
        continue
      }

      // Guard: skip if another worker already sent this message (VT expired race)
      if (payload.message_id) {
        const { data: alreadySent } = await checked(supabase
          .from('email_send_log')
          .select('id')
          .eq('message_id', payload.message_id)
          .eq('status', 'sent')
          .maybeSingle())

        if (alreadySent) {
          console.warn('Skipping duplicate send (already sent)', {
            queue,
            msg_id: msg.msg_id,
            message_id: payload.message_id,
          })
          await checked(supabase.rpc('delete_email', {
            queue_name: queue,
            message_id: msg.msg_id,
          }))
          continue
        }
      }

      try {
        // Recheck local suppression at delivery time, including after enqueue.
        if (postmark) {
          const { data: suppressed } = await checked(supabase
            .from('suppressed_emails').select('email').eq('email', payload.to.toLowerCase()).maybeSingle())
          if (suppressed) {
            await moveToDlq(supabase, queue, msg, 'Recipient suppressed')
            continue
          }
        }
        if (postmark) {
          const outcome = await postmark.deliver({
            ...payload,
            from: postmarkFrom!,
          })
          if (outcome.kind === 'configuration_error') {
            // Stop without discarding messages; repair provider settings first.
            return new Response(JSON.stringify({ processed: totalProcessed, stopped: 'provider_configuration' }), { status: 503 })
          }
          if (outcome.kind === 'suppressed' || outcome.kind === 'permanent_rejection') {
            await moveToDlq(supabase, queue, msg, `Postmark ${outcome.kind}; HTTP ${outcome.status}; code ${outcome.providerCode}`)
            continue
          }
          if (outcome.kind === 'rate_limited') {
            throw Object.assign(new Error('Postmark rate limited'), {
              status: 429, retryAfterSeconds: outcome.retryAfterSeconds,
            })
          }
          if (outcome.kind === 'ambiguous') {
            // Retain existing bounded retry policy. A lost receipt can cause duplicates.
            throw new Error('Postmark acceptance uncertain; retry may duplicate delivery')
          }
        } else await sendLovableEmail(
          {
            run_id: payload.run_id,
            to: payload.to,
            from: payload.from,
            sender_domain: payload.sender_domain,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            purpose: payload.purpose,
            label: payload.label,
            idempotency_key: payload.idempotency_key,
            unsubscribe_token: payload.unsubscribe_token,
            message_id: payload.message_id,
          },
          // sendUrl is optional — when LOVABLE_SEND_URL is not set, the library
          // falls back to the default Lovable API endpoint (https://api.lovable.dev).
          // Set LOVABLE_SEND_URL as a Supabase secret to override (e.g. for local dev).
          { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') }
        )

        // Log success
        await checked(supabase.from('email_send_log').insert({
          message_id: payload.message_id,
          template_name: payload.label || queue,
          recipient_email: payload.to,
          status: 'sent',
        }))

        // Delete from queue
        await checked(supabase.rpc('delete_email', {
          queue_name: queue,
          message_id: msg.msg_id,
        }))
        totalProcessed++
      } catch (error) {
        if (error instanceof QueueOperationError) throw error
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('Email send failed', {
          queue,
          msg_id: msg.msg_id,
          read_ct: msg.read_ct,
          failed_attempts: failedAttempts,
          error: errorMsg,
        })

        if (isRateLimited(error)) {
          await checked(supabase.from('email_send_log').insert({
            message_id: payload.message_id,
            template_name: payload.label || queue,
            recipient_email: payload.to,
            status: 'rate_limited',
            error_message: errorMsg.slice(0, 1000),
          }))

          const retryAfterSecs = getRetryAfterSeconds(error)
          await checked(supabase
            .from('email_send_state')
            .update({
              retry_after_until: new Date(
                Date.now() + retryAfterSecs * 1000
              ).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', 1))

          // Stop processing — remaining messages stay in queue (VT expires, retried next cycle)
          return new Response(
            JSON.stringify({ processed: totalProcessed, stopped: 'rate_limited' }),
            { headers: { 'Content-Type': 'application/json' } }
          )
        }

        // 403 means emails are disabled for this project — retrying won't help.
        // Move straight to DLQ and stop processing the rest of the batch.
        if (isForbidden(error)) {
          await moveToDlq(supabase, queue, msg, 'Emails disabled for this project')
          return new Response(
            JSON.stringify({ processed: totalProcessed, stopped: 'emails_disabled' }),
            { headers: { 'Content-Type': 'application/json' } }
          )
        }

        sendFailures++
        // Log non-429 failures to track real retry attempts.
        await checked(supabase.from('email_send_log').insert({
          message_id: payload.message_id,
          template_name: payload.label || queue,
          recipient_email: payload.to,
          status: 'failed',
          error_message: errorMsg.slice(0, 1000),
        }))
        if (payload?.message_id && typeof payload.message_id === 'string') {
          failedAttemptsByMessageId.set(payload.message_id, failedAttempts + 1)
        }

        // Non-429 errors: message stays invisible until VT expires, then retried
      }

      // Small delay between sends to smooth bursts
      if (i < messages.length - 1) {
        await new Promise((r) => setTimeout(r, sendDelayMs))
      }
    }
  }

  return new Response(
    JSON.stringify({ processed: totalProcessed, failed: sendFailures }),
    { status: sendFailures ? 503 : 200, headers: { 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  try {
    return await processQueue(req)
  } catch {
    // Avoid logging database/provider payloads containing recipient data or tokens.
    return new Response(JSON.stringify({ error: 'Email worker failed; retry after checking queue state' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } })
  }
})
