import { synthesizeSpeech } from '../_shared/speech-transport.ts'
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

    const audio = await synthesizeSpeech({
      text, voices,
      deepgramKey: Deno.env.get('DEEPGRAM_API_KEY'),
      elevenKey: Deno.env.get('ELEVENLABS_API_KEY'),
    })

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
