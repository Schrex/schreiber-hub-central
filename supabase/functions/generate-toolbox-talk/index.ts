import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Decode base64 in chunks to avoid stack overflow on large images
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
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

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin')
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { topic, category } = await req.json()
    if (!topic || typeof topic !== 'string') {
      return new Response(JSON.stringify({ error: 'topic is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableKey) throw new Error('LOVABLE_API_KEY not set')

    // 1) TEXT — punchy, foreman-style
    const systemPrompt = `You write 2-3 minute toolbox talks for Schreiber Excavating crews. Keep it tight, plain-spoken, and field-focused. No fluff.`
    const userPrompt = `Topic: "${topic}"${category ? ` (Category: ${category})` : ''}.

Return JSON:
{
  "title": "short title (max 6 words)",
  "category": "one word category",
  "content": "Markdown. STRICT structure:\\n**Why it matters** — 1 sentence.\\n**Hazards** — 3 short bullets.\\n**Do this** — 4 short bullets.\\n**Talk it over** — 1 question.\\nKeep total under 120 words.",
  "voice_script": "Plain spoken script (no markdown, no headings) for a foreman to read out loud to his crew. Warm, direct, caring tone — like a foreman who's looked after his guys for 20 years and wants them home safe. 90-130 words. Open with something like 'Alright fellas, gather up.' Use 'we' and 'you'. End with a check for questions.",
  "image_prompt": "One short prompt for a realistic photo of this hazard or safe practice on a heavy civil/excavation jobsite. No text in image.",
  "video_prompt": "One short prompt for a 5-second realistic jobsite video clip illustrating this topic. No text.",
  "quiz_questions": [
    { "question": "...", "options": ["A","B","C","D"], "correct_index": 0 },
    { "question": "...", "options": ["A","B","C","D"], "correct_index": 1 },
    { "question": "...", "options": ["A","B","C","D"], "correct_index": 2 }
  ]
}`

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
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: 'Rate limit, try again shortly' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      throw new Error(`AI error: ${aiResp.status}`)
    }
    const aiData = await aiResp.json()
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.content ?? '{}')

    // 2) IMAGE — generate via Lovable AI image model and upload to storage
    let image_url: string | null = null
    try {
      const imgPrompt = parsed.image_prompt || `Realistic photo of ${topic} on a heavy civil excavation jobsite, safe practice focus, no text`
      const imgResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image',
          messages: [{ role: 'user', content: imgPrompt }],
          modalities: ['image', 'text'],
        }),
      })
      if (imgResp.ok) {
        const imgData = await imgResp.json()
        const dataUrl: string | undefined = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url
        if (dataUrl?.startsWith('data:')) {
          const b64 = dataUrl.split(',')[1]
          const bytes = base64ToBytes(b64)
          const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
          const path = `talks/${crypto.randomUUID()}.png`
          const { error: upErr } = await admin.storage.from('talk-media').upload(path, bytes, { contentType: 'image/png', upsert: false })
          if (!upErr) {
            const { data: pub } = admin.storage.from('talk-media').getPublicUrl(path)
            image_url = pub.publicUrl
          } else {
            console.error('image upload failed', upErr)
          }
        }
      } else {
        console.warn('image gen failed', imgResp.status, await imgResp.text())
      }
    } catch (e) {
      console.warn('image generation skipped', e)
    }

    return new Response(JSON.stringify({
      title: parsed.title,
      category: parsed.category,
      content: parsed.content,
      voice_script: parsed.voice_script,
      quiz_questions: parsed.quiz_questions ?? [],
      image_url,
      video_prompt: parsed.video_prompt ?? null, // returned so admin UI can optionally trigger video
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('generate-toolbox-talk error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
