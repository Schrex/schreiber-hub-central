import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default OpenAI TTS voice via Lovable AI Gateway.
// "onyx" = deep, mature male — best foreman fit. Alternatives: echo, alloy, ash, sage.
const DEFAULT_OPENAI_VOICE = 'onyx'
const DEFAULT_ELEVEN_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb' // George (fallback)

async function resolveVoice(supabase: any): Promise<{ openai: string; eleven: string }> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'safety_talk_voice_id')
      .maybeSingle()
    const v = data?.value
    const obj = typeof v === 'object' && v !== null ? v : {}
    return {
      openai: (obj.openai_voice || DEFAULT_OPENAI_VOICE).trim(),
      eleven: (obj.voice_id || DEFAULT_ELEVEN_VOICE_ID).trim(),
    }
  } catch {
    return { openai: DEFAULT_OPENAI_VOICE, eleven: DEFAULT_ELEVEN_VOICE_ID }
  }
}

async function tryLovableAITTS(text: string, voice: string): Promise<ArrayBuffer | null> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  if (!lovableKey) {
    console.log('LOVABLE_API_KEY not set, skipping Lovable AI TTS')
    return null
  }
  try {
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/tts-1-hd',
        voice,
        input: text,
        response_format: 'mp3',
        speed: 0.96,
      }),
    })
    if (!resp.ok) {
      const errText = await resp.text()
      console.error('lovable ai tts failed', resp.status, errText.slice(0, 300))
      return null
    }
    return await resp.arrayBuffer()
  } catch (e) {
    console.error('lovable ai tts threw', e)
    return null
  }
}

async function tryElevenLabs(text: string, voiceId: string): Promise<ArrayBuffer | null> {
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
  if (!apiKey) return null
  try {
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_192`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.85,
            style: 0.15,
            use_speaker_boost: true,
            speed: 0.96,
          },
        }),
      }
    )
    if (!resp.ok) {
      const errText = await resp.text()
      console.error('elevenlabs fallback failed', resp.status, errText.slice(0, 300))
      return null
    }
    return await resp.arrayBuffer()
  } catch (e) {
    console.error('elevenlabs threw', e)
    return null
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

    const voices = await resolveVoice(supabase)

    // 1) Try Lovable AI Gateway (OpenAI TTS) first — zero setup, high quality
    let audio = await tryLovableAITTS(text, voices.openai)

    // 2) Fall back to ElevenLabs if available
    if (!audio) {
      console.log('Falling back to ElevenLabs')
      audio = await tryElevenLabs(text, voices.eleven)
    }

    // 3) If both failed, signal browser fallback
    if (!audio) {
      return new Response(
        JSON.stringify({ fallback: true, reason: 'voice_unavailable' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(audio, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error('speak-toolbox-talk error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
