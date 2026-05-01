import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  jobId: string
  requestedDate: string // YYYY-MM-DD
  startTime?: string | null // HH:MM
  material?: string | null
  pickupLocation?: string | null
  dumpLocation?: string | null
  loadQuantity?: number | string | null
  notes?: string | null
}

const DEFAULT_OFFICE_EMAIL = 'office@schrex.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Foreman/office/admin only
    const { data: roles } = await userClient.from('user_roles').select('role').eq('user_id', user.id)
    const allowed = (roles ?? []).some((r: any) => ['foreman', 'office', 'admin'].includes(r.role))
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = (await req.json()) as Body
    if (!body?.jobId || !body?.requestedDate) {
      return new Response(JSON.stringify({ error: 'jobId and requestedDate are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: job, error: jobErr } = await admin.from('jobs').select('*').eq('id', body.jobId).maybeSingle()
    if (jobErr || !job) throw new Error('Job not found')

    const { data: profile } = await admin.from('profiles').select('display_name, email').eq('user_id', user.id).maybeSingle()
    const requesterName = profile?.display_name || profile?.email || 'Schreiber Excavating'

    const loadQty = body.loadQuantity == null || body.loadQuantity === '' ? null : Number(body.loadQuantity)

    const { data: request, error: insErr } = await admin.from('truck_requests').insert({
      job_id: body.jobId,
      requested_date: body.requestedDate,
      start_time: body.startTime || null,
      material: body.material ?? null,
      pickup_location: body.pickupLocation ?? null,
      dump_location: body.dumpLocation ?? job.address ?? null,
      load_quantity: Number.isFinite(loadQty as number) ? loadQty : null,
      requester_id: user.id,
      requester_name: requesterName,
      requester_notes: body.notes ?? null,
      status: 'pending',
    }).select('id').single()
    if (insErr) throw insErr

    // Notify office
    const { data: setting } = await admin.from('app_settings').select('value').eq('key', 'office_dispatch_email').maybeSingle()
    const settingValue = setting?.value as any
    const recipient =
      (typeof settingValue === 'string' && settingValue) ||
      (settingValue && typeof settingValue === 'object' && settingValue.email) ||
      DEFAULT_OFFICE_EMAIL

    try {
      await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'truck-request-submitted',
          recipientEmail: recipient,
          idempotencyKey: `truck-request-submitted-${request.id}`,
          templateData: {
            jobNumber: job.job_number ?? '',
            jobName: job.name ?? '',
            address: job.address ?? '',
            requestedDate: body.requestedDate,
            startTime: body.startTime ?? '',
            material: body.material ?? '',
            pickupLocation: body.pickupLocation ?? '',
            dumpLocation: body.dumpLocation ?? job.address ?? '',
            loadQuantity: loadQty ?? '',
            notes: body.notes ?? '',
            requesterName,
          },
        },
      })
    } catch (e) {
      console.error('truck-request submit email failed', e)
    }

    return new Response(JSON.stringify({ ok: true, requestId: request.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('request-truck error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
