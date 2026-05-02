import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default: "George" — mature, grounded British-American male. Warmer and
// more natural-sounding than Brian for the foreman tone.
// Can be overridden per-project via the `safety_talk_voice_id` row in app_settings.
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'

async function resolveVoiceId(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'safety_talk_voice_id')
      .maybeSingle()
    const v = data?.value
    const id = typeof v === 'string' ? v : (v?.voice_id ?? '')
    return (id && id.trim()) || DEFAULT_VOICE_ID
  } catch {
    return DEFAULT_VOICE_ID
  }
}

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

    const { text } = await req.json()
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'text is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (text.length > 5000) {
      return new Response(JSON.stringify({ error: 'text too long (max 5000 chars)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set')

    const voiceId = await resolveVoiceId(supabase)
    const ttsResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: 0.95 },
        }),
      }
    )

    if (!ttsResp.ok) {
      const errText = await ttsResp.text()
      console.error('elevenlabs tts failed', ttsResp.status, errText)
      // Return 200 with a fallback signal so the client can use the browser's
      // built-in speech synthesis instead of crashing.
      return new Response(
        JSON.stringify({ fallback: true, reason: 'voice_unavailable', detail: errText.slice(0, 300) }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const audio = await ttsResp.arrayBuffer()
    return new Response(audio, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error('speak-toolbox-talk error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
