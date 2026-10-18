import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_YORK_EMAIL = 'info@yorksafetysolutions.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Admin only
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin')
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { jobId, notes } = await req.json()
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: job, error: jobErr } = await admin.from('jobs').select('*').eq('id', jobId).maybeSingle()
    if (jobErr || !job) throw new Error('Job not found')

    // Resolve recipient email from app_settings, fall back to default
    const { data: setting } = await admin.from('app_settings').select('value').eq('key', 'york_safety_email').maybeSingle()
    const settingValue = setting?.value as string | { email?: string } | null
    const recipient =
      (typeof settingValue === 'string' && settingValue) ||
      (settingValue && typeof settingValue === 'object' && settingValue.email) ||
      DEFAULT_YORK_EMAIL

    const { data: profile } = await admin.from('profiles').select('display_name, email').eq('user_id', user.id).maybeSingle()
    const requestedByName = profile?.display_name || profile?.email || 'Schreiber Excavating'

    // Record the request
    const { data: insp, error: insErr } = await admin.from('safety_inspections').insert({
      job_id: jobId,
      recipient_email: recipient,
      requested_by: user.id,
      requested_by_name: requestedByName,
      notes: notes ?? null,
      status: 'pending',
    }).select('id').single()
    if (insErr) throw insErr

    // Send email via the transactional dispatcher using supabase-js (handles auth headers correctly)
    const { data: sendData, error: sendErr } = await admin.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'safety-inspection-request',
        recipientEmail: recipient,
        idempotencyKey: `safety-inspection-${insp.id}`,
        templateData: {
          jobNumber: job.job_number ?? '',
          jobName: job.name ?? '',
          address: job.address ?? '',
          customer: job.customer ?? '',
          gc: job.gc ?? '',
          onSiteName: job.on_site_contact_name ?? '',
          onSitePhone: job.on_site_contact_phone ?? '',
          startDate: job.start_date ?? '',
          endDate: job.end_date ?? '',
          notes: notes ?? job.notes ?? '',
          requestedByName,
        },
      },
    })

    if (sendErr) {
      console.error('email send failed', sendErr)
      await admin.from('safety_inspections').update({ status: 'failed' }).eq('id', insp.id)
      throw new Error('Failed to send email')
    }

    await admin.from('safety_inspections').update({ status: 'sent' }).eq('id', insp.id)

    return new Response(JSON.stringify({ ok: true, recipient }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('request-safety-inspection error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
