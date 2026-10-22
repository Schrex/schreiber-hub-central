import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
type Role = 'employee' | 'foreman' | 'office' | 'admin'

interface Body {
  // Identity (always required)
  name: string
  first_name?: string | null
  last_name?: string | null
  middle_initial?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  department?: string | null
  notes?: string | null
  date_of_birth?: string | null
  hire_date?: string | null
  // Optional login
  createLogin?: boolean
  loginEmail?: string
  password?: string
  role?: Role
  // Optional position assignment (requires login)
  positionId?: string | null
  payRate?: number | null
  effectiveDate?: string | null
}


const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

// Inject the client factory so the exact handler can run against disposable local Auth/REST.
export function createEmployeeHandler(factory: typeof createClient, config: {
  url: string; anonKey: string; serviceKey: string
}) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
    if (req.method !== 'POST') return json(405, { error: 'Use POST' })
    const admin = factory(config.url, config.serviceKey, { auth: { persistSession: false } })
    let contactId: string | null = null
    let userId: string | null = null
    let callerId: string | null = null
    try {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' })
      const client = factory(config.url, config.anonKey, {
        global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
      })
      const { data, error } = await client.auth.getUser()
      if (error || !data.user) return json(401, { error: 'Unauthorized' })
      callerId = data.user.id
      let body: Body
      try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'Invalid employee details' })
      const textFields = ['name', 'first_name', 'last_name', 'middle_initial', 'email', 'phone', 'address', 'department', 'notes', 'date_of_birth', 'hire_date', 'loginEmail', 'role', 'positionId', 'effectiveDate'] as const
      if (textFields.some(key => body[key] != null && typeof body[key] !== 'string')
        || (body.createLogin != null && typeof body.createLogin !== 'boolean')
        || (body.payRate != null && (typeof body.payRate !== 'number' || !Number.isFinite(body.payRate)))) {
        return json(400, { error: 'Invalid employee details' })
      }
      if (typeof body.name !== 'string' || !body.name.trim()) return json(400, { error: 'Name is required' })
      if (body.createLogin && (typeof body.password !== 'string' || body.password.length < 8)) {
        return json(400, { error: 'Password must be at least 8 characters' })
      }
      // The service-only RPC authorizes and validates before any writes. Email locks
      // serialize this endpoint's duplicate checks. Passwords never enter SQL.
      const { password: _password, ...input } = body
      const reservationId = crypto.randomUUID()
      const details = { ...input, creationContactId: reservationId }
      contactId = reservationId
      const reserved = await admin.rpc('prepare_employee_creation', { caller_id: callerId, details })
      if (reserved.error) {
        if (/^(42501|P0001|22|23)/.test(reserved.error.code ?? '')) {
          return json(reserved.error.code === '42501' ? 403 : 400, { error: reserved.error.message })
        }
        return json(503, { error: 'Could not confirm contact creation. Check this reference before retrying.', cleanupRequired: true, contactId: reservationId })
      }
      if (reserved.data !== reservationId) return json(503, { error: 'Unexpected creation response; administrator review required.', cleanupRequired: true, contactId: reservationId })
      contactId = reservationId
      if (body.createLogin) {
        const created = await admin.auth.admin.createUser({
          email: body.loginEmail!.trim().toLowerCase(), password: body.password!, email_confirm: true,
          app_metadata: { employee_creation_contact_id: contactId },
          user_metadata: { display_name: body.name.trim(), full_name: body.name.trim() },
        })
        if (created.error || !created.data.user) throw new Error(created.error?.message ?? 'Could not create login')
        userId = created.data.user.id
        const finished = await admin.rpc('finish_employee_creation', {
          caller_id: callerId, contact_id: contactId, new_user_id: userId, details,
        })
        if (finished.error?.message === 'Login linked to another contact' || finished.error?.message === 'Contact already linked') {
          return json(500, { error: 'Unexpected existing linkage; administrator review required. Do not retry yet.', cleanupRequired: true, contactId, userId })
        }
        if (finished.error) throw new Error(finished.error.message)
      }
      return json(200, { success: true, contactId, userId })
    } catch (err) {
      // Delete Auth first (profiles and roles cascade), then our reserved contact.
      // A failed/uncertain cleanup is explicitly actionable, never a success toast.
      let cleanupFailed = false
      try {
        if (userId) {
          const deleted = await admin.auth.admin.deleteUser(userId)
          if (deleted.error) cleanupFailed = true
        }
        if (contactId && !cleanupFailed) {
          const deleted = await admin.rpc('cancel_employee_creation', { caller_id: callerId, contact_id: contactId })
          if (deleted.error) cleanupFailed = true
        }
      } catch { cleanupFailed = true }
      return json(500, {
        error: cleanupFailed
          ? 'Employee setup failed and cleanup needs administrator review. Do not retry yet.'
          : `${err instanceof Error ? err.message : 'Employee setup failed'}. Any confirmed new records were removed.`,
        ...(cleanupFailed ? { cleanupRequired: true, contactId, userId } : {}),
      })
    }
  }
}
