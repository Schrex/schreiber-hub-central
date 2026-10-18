import { profileEmails } from "../_shared/profileEmails.ts";
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

    const { violationId } = await req.json()
    if (!violationId) return json({ error: 'violationId required' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: v, error: vErr } = await admin.from('safety_violations').select('*').eq('id', violationId).maybeSingle()
    if (vErr || !v) throw new Error('Violation not found')

    // Authz: only the filer, or office/admin, can trigger notifications
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id)
    const isPrivileged = (roles ?? []).some((r: { role: string }) => r.role === 'office' || r.role === 'admin')
    if (v.filed_by !== user.id && !isPrivileged) {
      return json({ error: 'Forbidden' }, 403)
    }

    const { data: recipients } = await admin
      .from('user_roles')
      .select('user_id, profiles!inner(email)')
      .in('role', ['office', 'admin'])

    const emails = Array.from(new Set(
      (recipients ?? [])
        .flatMap(r => profileEmails(r.profiles))
    ))

    if (emails.length === 0) {
      console.warn('No office/admin recipients found')
      return json({ ok: true, sentTo: 0 })
    }

    const jobLabel = [v.job_number_snapshot ? `#${v.job_number_snapshot}` : null, v.job_name_snapshot]
      .filter(Boolean).join(' · ')

    const templateData = {
      filedByName: v.filed_by_name,
      employeeName: v.employee_name,
      department: v.department ?? '',
      violationDate: v.violation_date,
      jobLabel,
      violations: v.violations ?? [],
      comments: v.comments ?? '',
      disciplinaryAction: v.disciplinary_action,
      suspensionFrom: v.suspension_from ?? '',
      suspensionTo: v.suspension_to ?? '',
      photoCount: (v.photo_paths ?? []).length,
    }

    let sent = 0
    for (const email of emails) {
      const { error } = await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'safety-violation',
          recipientEmail: email,
          idempotencyKey: `safety-violation-${v.id}-${email}`,
          templateData,
        },
      })
      if (error) console.error('email send failed', email, error)
      else sent++
    }

    return json({ ok: true, sentTo: sent })
  } catch (e) {
    console.error('submit-safety-violation error', e)
    return json({ error: (e as Error).message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
