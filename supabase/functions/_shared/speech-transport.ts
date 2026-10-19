/** Existing speech transports, separated for synthetic testing. No environment reads. */
export interface SpeechRequest {
  text: string
  voices: { deepgram: string; eleven: string }
  deepgramKey?: string
  elevenKey?: string
}

export async function synthesizeSpeech(request: SpeechRequest, fetcher: typeof fetch = fetch): Promise<ArrayBuffer | null> {
  if (request.deepgramKey) {
    try {
      const response = await fetcher(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(request.voices.deepgram)}&encoding=mp3`, {
        method: 'POST',
        headers: { Authorization: `Token ${request.deepgramKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: request.text }),
      })
      if (response.ok) return await response.arrayBuffer()
    } catch { /* Continue to the existing secondary provider; never log payloads. */ }
  }
  if (request.elevenKey) {
    try {
      const response = await fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${request.voices.eleven}?output_format=mp3_44100_192`, {
        method: 'POST',
        headers: { 'xi-api-key': request.elevenKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: request.text, model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true, speed: 0.96 } }),
      })
      if (response.ok) return await response.arrayBuffer()
    } catch { /* Browser fallback remains available. */ }
  }
  return null
}

export type TranscriptionResult = { ok: true; transcript: string } | {
  ok: false; reason: string; message: string; fallback: true
}

export async function transcribeSpeech(file: Blob, apiKey: string, fetcher: typeof fetch = fetch): Promise<TranscriptionResult> {
  const form = new FormData()
  form.append('file', file, 'recording.webm')
  form.append('model_id', 'scribe_v2')
  form.append('tag_audio_events', 'false')
  form.append('diarize', 'false')
  let response: Response
  try {
    response = await fetcher('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST', headers: { 'xi-api-key': apiKey }, body: form,
    })
  } catch {
    throw new Error('Transcription request failed')
  }
  if (!response.ok) {
    let body: string
    try { body = await response.text() } catch { throw new Error('Invalid transcription response') }
    const blocked = response.status === 401 && body.includes('detected_unusual_activity')
    return {
      ok: false,
      reason: blocked ? 'elevenlabs_free_tier_blocked' : 'transcription_unavailable',
      message: blocked
        ? 'ElevenLabs free tier is blocked for this account. Upgrade to a paid plan to enable transcription.'
        : 'Transcription service unavailable. Recording was saved.',
      fallback: true,
    }
  }
  try {
    const data: unknown = await response.json()
    if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error()
    const text = (data as Record<string, unknown>).text
    if (text !== undefined && text !== null && typeof text !== 'string') throw new Error()
    return { ok: true, transcript: typeof text === 'string' ? text : '' }
  } catch {
    throw new Error('Invalid transcription response')
  }
}
