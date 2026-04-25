import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  contactId: string
  email: string
  password: string
  displayName?: string
  role?: 'employee' | 'foreman' | 'office' | 'admin'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const callerId = userData.user.id

    const admin = createClient(supabaseUrl, serviceKey)

    // Verify caller is admin
    const { data: roles, error: rolesErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
    if (rolesErr) throw rolesErr
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin')
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admins only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = (await req.json()) as Body
    const { contactId, email, password } = body
    if (!contactId || !email || !password) {
      return new Response(JSON.stringify({ error: 'contactId, email, and password are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Load contact
    const { data: contact, error: contactErr } = await admin
      .from('employee_contacts')
      .select('*')
      .eq('id', contactId)
      .maybeSingle()
    if (contactErr) throw contactErr
    if (!contact) {
      return new Response(JSON.stringify({ error: 'Contact not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (contact.converted_user_id) {
      return new Response(JSON.stringify({ error: 'Contact has already been converted to a login' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const displayName = body.displayName?.trim() || contact.name
    const role = body.role ?? 'employee'

    // Create the auth user (auto-confirmed so they can log in immediately)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, full_name: displayName },
    })
    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? 'Could not create user' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const newUserId = created.user.id

    // handle_new_user trigger creates profile + default 'employee' role.
    // Update the role if requested (admin/foreman/office)
    if (role !== 'employee') {
      // remove default and insert requested
      await admin.from('user_roles').delete().eq('user_id', newUserId).eq('role', 'employee')
      await admin.from('user_roles').insert({ user_id: newUserId, role })
    }

    // Mark contact as converted (kept for audit trail, hidden via converted_user_id)
    await admin
      .from('employee_contacts')
      .update({ converted_user_id: newUserId, is_active: false })
      .eq('id', contactId)

    return new Response(
      JSON.stringify({ success: true, userId: newUserId, email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
