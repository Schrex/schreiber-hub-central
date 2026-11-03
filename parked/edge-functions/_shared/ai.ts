// Provider-neutral AI access for Edge functions.
//
// Callers send OpenAI-compatible chat-completions bodies (messages, tools,
// response_format). Any provider with an OpenAI-compatible endpoint works by
// setting secrets; no provider is configured by default, so AI features
// answer 503 until one is chosen.
//
//   AI_API_URL      chat-completions URL, e.g.
//                   https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
//   AI_API_KEY      provider API key (server-side secret only)
//   AI_MODEL        text/vision model, e.g. gemini-2.5-flash
//   AI_IMAGE_MODEL  optional image-generation model; image steps are skipped without it

export const AI_NOT_CONFIGURED =
  'AI is not configured. Set AI_API_URL, AI_API_KEY and AI_MODEL to enable this feature.'

export interface AiSettings {
  url: string
  key: string
  model: string
  imageModel: string | null
}

export function aiSettings(): AiSettings | null {
  const url = Deno.env.get('AI_API_URL')?.trim()
  const key = Deno.env.get('AI_API_KEY')?.trim()
  const model = Deno.env.get('AI_MODEL')?.trim()
  if (!url || !key || !model) return null
  return { url, key, model, imageModel: Deno.env.get('AI_IMAGE_MODEL')?.trim() || null }
}

export function aiChatCompletion(
  ai: AiSettings,
  body: Record<string, unknown>,
  model: string = ai.model,
): Promise<Response> {
  return fetch(ai.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ai.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, model }),
  })
}
