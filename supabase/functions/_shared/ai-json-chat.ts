/** Provider-neutral boundary for chat-completions-compatible JSON responses.
 * Callers explicitly choose endpoint/model/key; this module reads no environment.
 */
export class AiHttpError extends Error {
  constructor(public readonly status: number) {
    super(`AI error ${status}`)
    this.name = 'AiHttpError'
  }
}

export interface JsonChatRequest {
  endpoint: string
  apiKey: string
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export async function requestJsonChat(
  request: JsonChatRequest,
  fetcher: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetcher(request.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${request.apiKey}` },
      body: JSON.stringify({ model: request.model, messages: request.messages,
        response_format: { type: 'json_object' } }),
    })
  } catch {
    // Transport exceptions can contain URLs or credentials; never forward them.
    throw new Error('AI request failed')
  }
  if (!response.ok) throw new AiHttpError(response.status)
  try {
    const envelope: unknown = await response.json()
    if (!object(envelope) || !Array.isArray(envelope.choices)) throw new Error()
    const first: unknown = envelope.choices[0]
    if (!object(first) || !object(first.message) || typeof first.message.content !== 'string') throw new Error()
    const parsed: unknown = JSON.parse(first.message.content)
    if (!object(parsed)) throw new Error()
    return parsed
  } catch {
    // Never surface provider bodies or model-generated text in error messages.
    throw new Error('Invalid AI response')
  }
}

/** Optional text fields retain the existing null/default behavior, rejecting objects. */
export function optionalAiText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error('Invalid AI response')
  return value
}
