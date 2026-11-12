// Server functions that write as the caller (spec #61). Every database write goes through the
// caller's own token so RLS and triggers see auth.uid(). The service role is never handed to a
// handler: it is used only inside the default email sink and the read-only admin lookup.
//
// Node, Vitest and Playwright import this file directly (Edge runtime is off locally), so keep
// URL/npm imports type-only, use `.ts` relative imports and never touch `Deno` at top level.
import type { createClient, SupabaseClient, User } from 'npm:@supabase/supabase-js@2'
import { notificationResult } from './notification-result.ts'
import { profileEmails } from './profileEmails.ts'

export type ClientFactory = typeof createClient
export interface CallerConfig { url: string; anonKey: string; serviceKey: string }

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

export interface CallerContext {
  /** Client bound to the caller's token. Use it for every read and write of business data. */
  db: SupabaseClient
  user: User
  /** Parsed JSON body (unvalidated). */
  body: unknown
  /** Active admins with an email address (read-only lookup; see AdminRecipientSource). */
  adminRecipients: AdminRecipientSource
  /** Queues each email through the sink. Never throws; a refusal becomes emailQueued: false. */
  sendEmails: (messages: EmailMessage[]) => Promise<{ emailQueued: boolean }>
}

export type CallerRun = (ctx: CallerContext, req: Request) => Promise<Response>

export interface CallerHandlerOptions {
  /** Only callers holding the admin role may run this function (office is refused, unlike trucks). */
  adminOnly?: boolean
  /** Defaults to send-transactional-email invoked with the service role (an email, not a DB write). */
  emailSink?: EmailSink
  /** Defaults to a service-role read of admin roles and profiles (employees cannot list admins). */
  adminRecipients?: AdminRecipientSource
}

/** Reads the caller's own role rows with the caller's token (user_roles allows own-row SELECT). */
export async function callerIsAdmin(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await db.from('user_roles').select('role').eq('user_id', userId)
  if (error || !Array.isArray(data)) return false
  return data.some((row: { role?: unknown }) => row.role === 'admin')
}

export function createCallerHandler(
  factory: ClientFactory, config: CallerConfig, run: CallerRun, options: CallerHandlerOptions = {},
) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
    if (req.method !== 'POST') return json(405, { error: 'Use POST' })
    const authorization = req.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' })
    const db = factory(config.url, config.anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await db.auth.getUser()
    if (error || !data?.user) return json(401, { error: 'Unauthorized' })
    if (options.adminOnly && !(await callerIsAdmin(db, data.user.id))) return json(403, { error: 'Forbidden' })
    let body: unknown
    try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }
    const emailSink = options.emailSink ?? serviceRoleEmailSink(factory, config)
    const adminRecipients = options.adminRecipients ?? serviceRoleAdminRecipients(factory, config)
    return run({ db, user: data.user, body, adminRecipients, sendEmails: m => queueEmails(emailSink, m) }, req)
  }
}

export interface Recipient { userId: string; email: string; name: string | null }
interface RoleRow { user_id: string; role: string }
interface ProfileRow { user_id: string; email: string | null; is_active: boolean | null; display_name?: string | null }

/**
 * Active admins with a usable email, once per person and once per address (story 39).
 * has_role() ignores profiles.is_active, so "active admin" needs both the role and the flag.
 */
export function pickActiveAdminRecipients(roles: RoleRow[], profiles: ProfileRow[]): Recipient[] {
  const admins = new Set(roles.filter(r => r.role === 'admin').map(r => r.user_id))
  const seenUsers = new Set<string>()
  const seenEmails = new Set<string>()
  const recipients: Recipient[] = []
  for (const profile of profiles) {
    if (!admins.has(profile.user_id) || profile.is_active !== true || seenUsers.has(profile.user_id)) continue
    const [email] = profileEmails(profile)
    if (!email) continue
    const address = email.trim().toLowerCase()
    if (seenEmails.has(address)) continue
    seenUsers.add(profile.user_id)
    seenEmails.add(address)
    recipients.push({ userId: profile.user_id, email: email.trim(), name: profile.display_name ?? null })
  }
  return recipients
}

export type AdminRecipientSource = () => Promise<Recipient[]>

/**
 * Read-only lookup of active admins. user_roles is own-row-only for employees, so the caller's
 * token cannot find admins; the service role is used for these two SELECTs and nothing else.
 */
export function serviceRoleAdminRecipients(factory: ClientFactory, config: CallerConfig): AdminRecipientSource {
  return async () => {
    const reader = factory(config.url, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const roles = await reader.from('user_roles').select('user_id, role').eq('role', 'admin')
    if (roles.error) throw new Error('Could not load admin recipients')
    const ids = [...new Set((roles.data ?? []).map((r: RoleRow) => r.user_id))]
    if (!ids.length) return []
    const profiles = await reader.from('profiles').select('user_id, email, is_active, display_name').in('user_id', ids)
    if (profiles.error) throw new Error('Could not load admin recipients')
    return pickActiveAdminRecipients(roles.data ?? [], profiles.data ?? [])
  }
}

export type TimeOffEmailEvent = 'requested' | 'decision' | 'changed' | 'cancelled'

/** Stable per request + recipient + event, so a retried function call never sends twice. */
export function timeOffIdempotencyKey(event: TimeOffEmailEvent, requestId: string, recipientUserId: string): string {
  return `time-off-${event}-${requestId}-${recipientUserId}`
}

export interface EmailMessage {
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData: Record<string, unknown>
}

/** Queue acceptance only; provider delivery is never proven here. */
export type EmailSink = (message: EmailMessage) => Promise<'queued' | 'failed'>

/** send-transactional-email rejects employee JWTs, so the sink invokes it with the service role. */
export function serviceRoleEmailSink(factory: ClientFactory, config: CallerConfig): EmailSink {
  return async message => {
    const sender = factory(config.url, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await sender.functions.invoke('send-transactional-email', { body: message })
    return notificationResult(data, error)
  }
}

/** Every message is attempted; emailQueued is true only if there was at least one and all queued. */
export async function queueEmails(sink: EmailSink, messages: EmailMessage[]): Promise<{ emailQueued: boolean }> {
  let allQueued = messages.length > 0
  for (const message of messages) {
    let result: 'queued' | 'failed' = 'failed'
    try { result = await sink(message) } catch { result = 'failed' }
    if (result !== 'queued') allQueued = false
  }
  return { emailQueued: allQueued }
}
