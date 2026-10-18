import type { Database } from '../../../src/integrations/supabase/types.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Deepgram Aura voice. "aura-orion-en" = deep, mature male — best foreman fit.
// Alternatives: aura-arcas-en (warm male), aura-perseus-en (authoritative male).
const DEFAULT_DEEPGRAM_VOICE = 'aura-2-zeus-en'
const DEFAULT_ELEVEN_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'

async function resolveVoice(supabase: SupabaseClient<Database>): Promise<{ deepgram: string; eleven: string }> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'safety_talk_voice_id')
      .maybeSingle()
    const v = data?.value
    const obj = typeof v === 'object' && v !== null && !Array.isArray(v) ? v : {}
    return {
      deepgram: (typeof obj.deepgram_voice === 'string' && obj.deepgram_voice || DEFAULT_DEEPGRAM_VOICE).trim(),
      eleven: (typeof obj.voice_id === 'string' && obj.voice_id || DEFAULT_ELEVEN_VOICE_ID).trim(),
    }
  } catch {
    return { deepgram: DEFAULT_DEEPGRAM_VOICE, eleven: DEFAULT_ELEVEN_VOICE_ID }
  }
}

async function tryDeepgram(text: string, voice: string): Promise<ArrayBuffer | null> {
  const apiKey = Deno.env.get('DEEPGRAM_API_KEY')
  if (!apiKey) {
    console.log('DEEPGRAM_API_KEY not set, skipping Deepgram')
    return null
  }
  try {
    const resp = await fetch(
      `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice)}&encoding=mp3`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      }
    )
    if (!resp.ok) {
      const errText = await resp.text()
      console.error('deepgram tts failed', resp.status, errText.slice(0, 300))
      return null
    }
    return await resp.arrayBuffer()
  } catch (e) {
    console.error('deepgram threw', e)
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
    const supabase = createClient<Database>(
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

    // 1) Try Deepgram Aura first — natural foreman voice
    let audio = await tryDeepgram(text, voices.deepgram)

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
