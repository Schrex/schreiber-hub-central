import type { Database } from "../../../src/integrations/supabase/types.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://app.schreiberexcavating.com'

// Direct Twilio REST API. Off until TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
// TWILIO_FROM_NUMBER are set as Edge function secrets.
async function sendSms(to: string, body: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')
  if (!accountSid || !authToken || !fromNumber) {
    return { ok: false, reason: 'twilio_not_configured' }
  }
  try {
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
    })
    const data = await resp.json()
    if (!resp.ok) return { ok: false, reason: data?.message ?? `http ${resp.status}` }
    return { ok: true, sid: data.sid }
  } catch (e) {
    return { ok: false, reason: (e as Error).message }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabase = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { sessionId } = await req.json()
    if (!sessionId) return new Response(JSON.stringify({ error: 'sessionId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Authorize: must be foreman of session or admin
    const { data: session } = await supabase
      .from('toolbox_talk_sessions')
      .select('id, foreman_id, foreman_name, talk_id, talks:toolbox_talks(title)')
      .eq('id', sessionId)
      .maybeSingle()
    if (!session) return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin')
    if (session.foreman_id !== user.id && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: attendees } = await supabase
      .from('toolbox_talk_attendees')
      .select('id, user_id, attendee_name, access_token, signed_at, notified_at')
      .eq('session_id', sessionId)

    const userIds = (attendees ?? []).map((a: { user_id: string | null }) => a.user_id).filter(Boolean)
    const { data: contacts } = userIds.length
      ? await supabase
          .from('employee_contacts')
          .select('phone, converted_user_id')
          .in('converted_user_id', userIds)
      : { data: [] as { converted_user_id: string | null; phone: string | null }[] }
    const phoneByUser = new Map<string, string | null>()
    for (const c of contacts ?? []) {
      if (c.converted_user_id) phoneByUser.set(c.converted_user_id, c.phone ?? null)
    }

    const talkTitle = session.talks?.title ?? 'Toolbox talk'
    const results: { attendee_id: string; name: string; channel: string }[] = []

    // Use service role to insert notifications + update attendees regardless of RLS quirks
    const admin = createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    for (const a of attendees ?? []) {
      if (!a.user_id) continue
      const link = `${APP_BASE_URL}/safety/take/${a.access_token}`

      // In-app notification
      await admin.from('notifications').insert({
        user_id: a.user_id,
        kind: 'safety_talk_invite',
        title: 'Safety talk: action required',
        body: `${session.foreman_name ?? 'Your foreman'} wants you to complete "${talkTitle}". Take the quiz and sign on your phone.`,
        link_url: `/safety/take/${a.access_token}`,
        metadata: { session_id: sessionId, attendee_id: a.id },
      })

      // SMS
      const phone = phoneByUser.get(a.user_id) ?? null
      let channel = 'in_app'
      if (phone) {
        const sms = await sendSms(
          phone,
          `Schreiber Safety: ${session.foreman_name ?? 'Your foreman'} needs you to complete the safety talk "${talkTitle}". Open: ${link}`
        )
        if (sms.ok) channel = 'in_app+sms'
        else channel = `in_app (sms failed: ${sms.reason})`
      }

      await admin.from('toolbox_talk_attendees').update({
        notified_at: new Date().toISOString(),
        notify_channel: channel,
        phone_snapshot: phone,
      }).eq('id', a.id)

      results.push({ attendee_id: a.id, name: a.attendee_name, channel })
    }

    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('notify-talk-attendees error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
