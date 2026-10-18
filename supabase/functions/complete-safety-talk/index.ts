import type { Tables } from "../../../src/integrations/supabase/types.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch { return iso }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { sessionId, extraRecipients } = await req.json()
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Load session + talk
    const { data: session, error: sErr } = await admin
      .from('toolbox_talk_sessions')
      .select('id, foreman_id, foreman_name, talk_id, job_id, status, started_at, completed_at, transcript')
      .eq('id', sessionId)
      .maybeSingle()
    if (sErr) throw sErr
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Authz: foreman of session OR admin
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id)
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin')
    if (session.foreman_id !== user.id && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: talk } = await admin
      .from('toolbox_talks')
      .select('title, category, content, quiz_questions')
      .eq('id', session.talk_id).maybeSingle()

    const { data: attendees } = await admin
      .from('toolbox_talk_attendees')
      .select('attendee_name, signed_at, quiz_score, quiz_total, quiz_completed_at')
      .eq('session_id', sessionId)
      .order('attendee_name')

    const list = attendees ?? []
    const hasQuiz = Array.isArray(talk?.quiz_questions) && talk.quiz_questions.length > 0
    const missing = list.filter((a: Pick<Tables<"toolbox_talk_attendees">, "signed_at" | "quiz_completed_at" | "attendee_name" | "quiz_score" | "quiz_total">) => {
      if (!a.signed_at) return true
      if (hasQuiz && !a.quiz_completed_at) return true
      return false
    })

    if (list.length === 0) {
      return new Response(JSON.stringify({ error: 'no_attendees', message: 'Add at least one attendee before completing the talk.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (missing.length > 0) {
      return new Response(JSON.stringify({
        error: 'incomplete_attendees',
        message: 'Every attendee must sign and complete the quiz before completing the talk.',
        missing: missing.map((m: { attendee_name: string }) => m.attendee_name),
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Job details for the email
    let job: Pick<Tables<"jobs">, "job_number" | "name" | "address" | "customer" | "gc"> | null = null
    if (session.job_id) {
      const { data } = await admin
        .from('jobs')
        .select('job_number, name, address, customer, gc')
        .eq('id', session.job_id).maybeSingle()
      job = data
    }

    // Recipients: all office + admin staff (Lovable Cloud emails), plus optional extras (e.g. customer)
    const { data: officeUsers } = await admin
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['office', 'admin'])
    const officeIds = Array.from(new Set((officeUsers ?? []).map((r: { user_id: string }) => r.user_id)))
    const { data: officeProfiles } = officeIds.length
      ? await admin.from('profiles').select('email').in('user_id', officeIds).eq('is_active', true)
      : { data: [] as { email: string | null }[] }

    const recipients = new Set<string>()
    for (const p of officeProfiles ?? []) {
      if (p.email && typeof p.email === 'string') recipients.add(p.email.trim().toLowerCase())
    }
    // Only admins may CC arbitrary external recipients (e.g. customer).
    // Foremen completing their own talk cannot exfiltrate to external addresses.
    if (Array.isArray(extraRecipients) && isAdmin) {
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const e of extraRecipients) {
        if (typeof e === 'string' && EMAIL_RE.test(e.trim())) {
          recipients.add(e.trim().toLowerCase())
        }
      }
    }

    // Mark session complete BEFORE sending so retries are safe
    const completedAt = session.completed_at ?? new Date().toISOString()
    await admin.from('toolbox_talk_sessions')
      .update({ status: 'complete', completed_at: completedAt })
      .eq('id', sessionId)

    const templateData = {
      talkTitle: talk?.title ?? 'Toolbox talk',
      talkCategory: talk?.category ?? '',
      jobNumber: job?.job_number ?? '',
      jobName: job?.name ?? '',
      address: job?.address ?? '',
      customer: job?.customer ?? '',
      gc: job?.gc ?? '',
      foremanName: session.foreman_name ?? 'Foreman',
      heldAt: fmtDate(session.started_at),
      attendees: list.map((a: Pick<Tables<"toolbox_talk_attendees">, "signed_at" | "quiz_completed_at" | "attendee_name" | "quiz_score" | "quiz_total">) => ({
        name: a.attendee_name,
        signed: !!a.signed_at,
        quizScore: a.quiz_score,
        quizTotal: a.quiz_total,
      })),
      transcript: session.transcript ?? '',
      talkContent: talk?.content ?? '',
    }

    const sent: { recipient: string; ok: boolean; error?: string }[] = []
    for (const recipient of recipients) {
      const { error } = await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'safety-talk-summary',
          recipientEmail: recipient,
          idempotencyKey: `safety-talk-summary-${sessionId}-${recipient}`,
          templateData,
        },
      })
      sent.push({ recipient, ok: !error, error: error?.message })
    }

    return new Response(JSON.stringify({
      ok: true,
      sent,
      recipientCount: recipients.size,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('complete-safety-talk error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
