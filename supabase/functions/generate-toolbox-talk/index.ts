import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Verify admin role
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const isAdmin = (roles ?? []).some((r: any) => r.role === 'admin')
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { topic, category } = await req.json()
    if (!topic || typeof topic !== 'string') {
      return new Response(JSON.stringify({ error: 'topic is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableKey) throw new Error('LOVABLE_API_KEY not set')

    const systemPrompt = `You are a construction safety expert writing weekly toolbox talks for Schreiber Excavating, a heavy civil/excavation company. Generate practical, field-relevant safety talks that foremen can deliver in 5-10 minutes.`

    const userPrompt = `Generate a toolbox talk on: "${topic}"${category ? ` (Category: ${category})` : ''}.

Return JSON with this exact shape:
{
  "title": "Short clear title",
  "category": "category like Trenching, PPE, Equipment, Heat, etc",
  "content": "Full talk content in markdown. Include: Why it matters (1-2 sentences), Key hazards (3-5 bullets), Safe practices (5-7 bullets), Discussion questions (2-3). Be concrete and field-focused.",
  "quiz_questions": [
    { "question": "...", "options": ["A","B","C","D"], "correct_index": 0 },
    { "question": "...", "options": ["A","B","C","D"], "correct_index": 1 },
    { "question": "...", "options": ["A","B","C","D"], "correct_index": 2 }
  ]
}

Generate 3-5 quiz questions. Make them practical, not trivia.`

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!aiResp.ok) {
      const errText = await aiResp.text()
      console.error('AI gateway error', aiResp.status, errText)
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit reached, try again shortly' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      throw new Error(`AI error: ${aiResp.status}`)
    }
    const aiData = await aiResp.json()
    const raw = aiData.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)

    return new Response(JSON.stringify(parsed), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('generate-toolbox-talk error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
