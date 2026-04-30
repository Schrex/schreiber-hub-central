import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { sessionId, audioPath } = await req.json()
    if (!sessionId || !audioPath) {
      return new Response(JSON.stringify({ error: 'sessionId and audioPath required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Verify the user owns the session
    const { data: session } = await admin.from('toolbox_talk_sessions').select('foreman_id').eq('id', sessionId).maybeSingle()
    if (!session || session.foreman_id !== user.id) {
      // allow admins
      const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id)
      const isAdmin = (roles ?? []).some((r: any) => r.role === 'admin')
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Download audio
    const { data: file, error: dlErr } = await admin.storage.from('talk-audio').download(audioPath)
    if (dlErr || !file) throw new Error('Could not download audio: ' + (dlErr?.message ?? 'no file'))

    const elevenKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!elevenKey) {
      // Mark session anyway so flow doesn't break
      await admin.from('toolbox_talk_sessions').update({ transcript: '[Transcription unavailable: ELEVENLABS_API_KEY not configured]' }).eq('id', sessionId)
      return new Response(JSON.stringify({ ok: false, reason: 'no_api_key' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const fd = new FormData()
    fd.append('file', file, 'recording.webm')
    fd.append('model_id', 'scribe_v2')
    fd.append('tag_audio_events', 'false')
    fd.append('diarize', 'false')

    const resp = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': elevenKey },
      body: fd,
    })
    if (!resp.ok) {
      const t = await resp.text()
      console.error('ElevenLabs error', resp.status, t)
      let reason = 'transcription_unavailable'
      let message = 'Transcription service unavailable. Recording was saved.'
      if (resp.status === 401 && t.includes('detected_unusual_activity')) {
        reason = 'elevenlabs_free_tier_blocked'
        message = 'ElevenLabs free tier is blocked for this account. Upgrade to a paid plan to enable transcription.'
      }
      await admin.from('toolbox_talk_sessions').update({ transcript: `[${message}]` }).eq('id', sessionId)
      return new Response(JSON.stringify({ ok: false, reason, message, fallback: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const data = await resp.json()
    const transcript = data.text ?? ''

    await admin.from('toolbox_talk_sessions').update({ transcript }).eq('id', sessionId)

    return new Response(JSON.stringify({ ok: true, transcript }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('transcribe-toolbox-talk error', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, fallback: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
