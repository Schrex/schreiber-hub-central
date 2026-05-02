import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return json(401, { error: 'Unauthorized' })
    const callerId = userData.user.id

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', callerId)
    const callerRoles = new Set((roles ?? []).map((r: { role: string }) => r.role))
    const canCreate = callerRoles.has('admin') || callerRoles.has('office') || callerRoles.has('foreman')
    if (!canCreate) return json(403, { error: 'Not allowed' })
    const isAdmin = callerRoles.has('admin')

    const body = (await req.json()) as Body
    const name = body.name?.trim()
    if (!name) return json(400, { error: 'Name is required' })

    // Login + position require admin
    if ((body.createLogin || body.positionId) && !isAdmin) {
      return json(403, { error: 'Only admins can create logins or assign positions' })
    }
    if (body.positionId && !body.createLogin) {
      return json(400, { error: 'A login is required to assign a position' })
    }
    if (body.createLogin) {
      if (!body.loginEmail?.trim()) return json(400, { error: 'Login email is required' })
      if (!body.password || body.password.length < 8) return json(400, { error: 'Password must be at least 8 characters' })
    }
    if (body.positionId) {
      if (typeof body.payRate !== 'number' || body.payRate < 0) {
        return json(400, { error: 'Valid pay rate is required' })
      }
    }

    // 1) Create contact
    const { data: contact, error: contactErr } = await admin
      .from('employee_contacts')
      .insert({
        name,
        first_name: body.first_name?.trim() || null,
        last_name: body.last_name?.trim() || null,
        middle_initial: body.middle_initial?.trim()?.charAt(0).toUpperCase() || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        department: body.department?.trim() || null,
        notes: body.notes?.trim() || null,
        date_of_birth: body.date_of_birth || null,
        hire_date: body.hire_date || null,
        created_by: callerId,
        is_active: true,
      })
      .select('id')
      .single()
    if (contactErr || !contact) return json(400, { error: contactErr?.message ?? 'Could not create contact' })
    const contactId = contact.id as string

    let newUserId: string | null = null

    // 2) Optional login
    if (body.createLogin) {
      const role: Role = body.role ?? 'employee'
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: body.loginEmail!.trim(),
        password: body.password!,
        email_confirm: true,
        user_metadata: { display_name: name, full_name: name },
      })
      if (createErr || !created?.user) {
        // rollback contact
        await admin.from('employee_contacts').delete().eq('id', contactId)
        return json(400, { error: createErr?.message ?? 'Could not create login' })
      }
      newUserId = created.user.id

      // handle_new_user trigger may auto-link via email match. Force link to the contact we just made.
      await admin
        .from('employee_contacts')
        .update({ converted_user_id: newUserId, is_active: true })
        .eq('id', contactId)

      // Ensure profile.contact_id points to this contact (handle_new_user may have linked an older one)
      await admin.from('profiles').update({ contact_id: contactId }).eq('user_id', newUserId)

      if (role !== 'employee') {
        await admin.from('user_roles').delete().eq('user_id', newUserId).eq('role', 'employee')
        await admin.from('user_roles').insert({ user_id: newUserId, role })
      }

      // 3) Optional position
      if (body.positionId) {
        const effective = body.effectiveDate || new Date().toISOString().slice(0, 10)
        const { error: posErr } = await admin.from('employee_positions').insert({
          user_id: newUserId,
          position_id: body.positionId,
          pay_rate: body.payRate,
          effective_date: effective,
          created_by: callerId,
        })
        if (posErr) {
          // Don't rollback the user — surface a partial-success warning instead
          return json(200, {
            success: true,
            contactId,
            userId: newUserId,
            warning: `Login created but position assignment failed: ${posErr.message}`,
          })
        }
      }
    }

    return json(200, { success: true, contactId, userId: newUserId })
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Unknown error' })
  }
})
