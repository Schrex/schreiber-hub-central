import { createClient } from 'npm:@supabase/supabase-js@2'
import { AI_NOT_CONFIGURED, aiChatCompletion, aiSettings } from '../_shared/ai.ts'

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

    const { jobId, date } = await req.json()
    if (!jobId || !date) {
      return new Response(JSON.stringify({ error: 'jobId and date required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Pull schedule rows for this job/date
    const { data: assigns } = await supabase
      .from('schedule_assignments')
      .select('user_id, role_on_job, notes, start_time')
      .eq('job_id', jobId)
      .eq('assignment_date', date)

    const { data: job } = await supabase
      .from('jobs')
      .select('name, address, notes')
      .eq('id', jobId)
      .maybeSingle()

    const roles = Array.from(new Set((assigns ?? []).map((a: { role_on_job: string | null }) => (a.role_on_job ?? '').trim()).filter(Boolean)))
    const taskNotes = (assigns ?? []).map((a: { notes: string | null }) => a.notes).filter(Boolean)

    const ai = aiSettings()
    if (!ai) return new Response(JSON.stringify({ error: AI_NOT_CONFIGURED }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Look at existing talks library for matches first
    const { data: talks } = await supabase
      .from('toolbox_talks')
      .select('id, title, category, content')
      .eq('is_active', true)

    const prompt = `You pick or suggest a toolbox safety talk for an excavation crew.

Job: ${job?.name ?? 'Unknown'} ${job?.address ? '@ ' + job.address : ''}
Job notes: ${job?.notes ?? '(none)'}
Roles scheduled today: ${roles.join(', ') || '(unspecified)'}
Crew notes for today: ${taskNotes.join(' | ') || '(none)'}

Existing talks library (id — title — category):
${(talks ?? []).map((t: { id: string; title: string; category: string | null }) => `${t.id} — ${t.title} — ${t.category ?? ''}`).join('\n') || '(empty)'}

Return JSON:
{
  "match_talk_id": "uuid or null — pick from library if a strong match exists",
  "suggested_topic": "if no match, a short specific topic (max 6 words) tied to today's tasks/roles",
  "reasoning": "one short sentence why"
}`

    const aiResp = await aiChatCompletion(ai, {
      messages: [
        { role: 'system', content: 'You match crew tasks to relevant safety talks. Be concise.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    })
    if (!aiResp.ok) {
      const t = await aiResp.text()
      console.error('ai gateway', aiResp.status, t)
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: 'Rate limit, try again' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      throw new Error('AI error ' + aiResp.status)
    }
    const aiData = await aiResp.json()
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.content ?? '{}')

    return new Response(JSON.stringify({
      match_talk_id: parsed.match_talk_id ?? null,
      suggested_topic: parsed.suggested_topic ?? null,
      reasoning: parsed.reasoning ?? '',
      roles, taskNotes,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('suggest-safety-topic error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
