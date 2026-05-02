import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { reportId } = await req.json()
    if (!reportId) return json({ error: 'reportId required' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: report, error: rErr } = await admin.from('accident_reports').select('*').eq('id', reportId).maybeSingle()
    if (rErr || !report) throw new Error('Report not found')

    // Recipients: all office + admin users
    const { data: recipients } = await admin
      .from('user_roles')
      .select('user_id, profiles!inner(email)')
      .in('role', ['office', 'admin'])

    const emails = Array.from(new Set(
      (recipients ?? [])
        .map((r: any) => r.profiles?.email)
        .filter((e: string | null | undefined): e is string => !!e && e.includes('@'))
    ))

    if (emails.length === 0) {
      console.warn('No office/admin recipients found')
      return json({ ok: true, sentTo: 0 })
    }

    const incidentAt = new Date(report.incident_at).toLocaleString('en-US', {
      timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
    })
    const jobLabel = [report.job_number_snapshot ? `#${report.job_number_snapshot}` : null, report.job_name_snapshot]
      .filter(Boolean).join(' · ')

    const templateData = {
      reportedByName: report.reported_by_name,
      incidentAt,
      incidentType: report.incident_type,
      severity: report.severity,
      jobLabel,
      location: report.location ?? '',
      description: report.description ?? '',
      injuredPersonName: report.injured_person_name ?? '',
      bodyPart: report.body_part ?? '',
      witnesses: report.witnesses ?? '',
      immediateAction: report.immediate_action ?? '',
      contributingFactors: report.contributing_factors ?? '',
      photoCount: (report.photo_paths ?? []).length,
    }

    let sent = 0
    for (const email of emails) {
      const { error } = await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'accident-report',
          recipientEmail: email,
          idempotencyKey: `accident-report-${report.id}-${email}`,
          templateData,
        },
      })
      if (error) console.error('email send failed', email, error)
      else sent++
    }

    return json({ ok: true, sentTo: sent })
  } catch (e) {
    console.error('submit-accident-report error', e)
    return json({ error: (e as Error).message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
