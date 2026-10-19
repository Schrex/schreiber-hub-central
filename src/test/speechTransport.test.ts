import { describe, expect, it, vi } from 'vitest';
import { synthesizeSpeech, transcribeSpeech } from '../../supabase/functions/_shared/speech-transport.ts';
const request = { text: 'Synthetic safety text', voices: { deepgram: 'test voice', eleven: 'test-voice' }, deepgramKey: 'fake-deepgram', elevenKey: 'fake-eleven' };
const bytes = new Uint8Array([1, 2, 3]);
const file = new Blob([bytes], { type: 'audio/webm' });

describe('speech transports with fake fetch only', () => {
  it('uses Deepgram first and preserves audio bytes and request contract', async () => {
    const fake = vi.fn().mockResolvedValue(new Response(bytes));
    expect(new Uint8Array((await synthesizeSpeech(request, fake))!)).toEqual(bytes);
    expect(fake).toHaveBeenCalledExactlyOnceWith('https://api.deepgram.com/v1/speak?model=test%20voice&encoding=mp3', {
      method: 'POST', headers: { Authorization: 'Token fake-deepgram', 'Content-Type': 'application/json' }, body: JSON.stringify({ text: request.text }),
    });
  });
  it.each(['http', 'network', 'body'])('falls back to ElevenLabs after primary %s failure', async failure => {
    const fake = vi.fn();
    if (failure === 'http') fake.mockResolvedValueOnce(new Response('private body', { status: 429 }));
    if (failure === 'network') fake.mockRejectedValueOnce(new Error('private transport details'));
    if (failure === 'body') fake.mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.reject(new Error('body failure')) });
    fake.mockResolvedValueOnce(new Response(bytes));
    expect(new Uint8Array((await synthesizeSpeech(request, fake))!)).toEqual(bytes);
    expect(fake).toHaveBeenCalledTimes(2);
    const [url, init] = fake.mock.calls[1];
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/test-voice?output_format=mp3_44100_192');
    expect(init.headers).toEqual({ 'xi-api-key': 'fake-eleven', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ text: request.text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true, speed: 0.96 } });
  });
  it('skips unavailable keys without making requests', async () => {
    const fake = vi.fn();
    expect(await synthesizeSpeech({ ...request, deepgramKey: undefined, elevenKey: undefined }, fake)).toBeNull();
    expect(fake).not.toHaveBeenCalled();
  });
  it('uses secondary directly when only its key exists', async () => {
    const fake = vi.fn().mockResolvedValue(new Response(bytes));
    expect(await synthesizeSpeech({ ...request, deepgramKey: undefined }, fake)).toBeInstanceOf(ArrayBuffer);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake.mock.calls[0][0]).toContain('api.elevenlabs.io');
  });
  it.each(['http', 'network'])('returns browser fallback when both providers fail (%s)', async failure => {
    const fake = failure === 'http' ? vi.fn().mockResolvedValue(new Response('private', { status: 500 })) : vi.fn().mockRejectedValue(new Error('private'));
    expect(await synthesizeSpeech(request, fake)).toBeNull();
    expect(fake).toHaveBeenCalledTimes(2);
  });
  it('posts original audio bytes with existing transcription multipart fields', async () => {
    const fake = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'Synthetic transcript' })));
    expect(await transcribeSpeech(file, 'fake-key', fake)).toEqual({ ok: true, transcript: 'Synthetic transcript' });
    const [url, init] = fake.mock.calls[0];
    expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'xi-api-key': 'fake-key' });
    const form = init.body as FormData;
    expect([...form.keys()]).toEqual(['file', 'model_id', 'tag_audio_events', 'diarize']);
    const uploaded = form.get('file') as File;
    expect(uploaded.name).toBe('recording.webm');
    const uploadedBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(uploaded);
    });
    expect(new Uint8Array(uploadedBytes)).toEqual(bytes);
    expect(form.get('model_id')).toBe('scribe_v2');
    expect(form.get('diarize')).toBe('false');
    expect(form.get('tag_audio_events')).toBe('false');
  });
  it.each([{}, { text: null }])('preserves optional transcript default', async value => {
    expect(await transcribeSpeech(file, 'fake', vi.fn().mockResolvedValue(new Response(JSON.stringify(value))))).toEqual({ ok: true, transcript: '' });
  });
  it.each([401, 429, 500])('returns generic fallback for HTTP %s without provider body', async status => {
    const result = await transcribeSpeech(file, 'fake', vi.fn().mockResolvedValue(new Response('private provider data', { status })));
    expect(result).toEqual({ ok: false, reason: 'transcription_unavailable', message: 'Transcription service unavailable. Recording was saved.', fallback: true });
  });
  it('retains existing free-tier blocked response', async () => {
    const result = await transcribeSpeech(file, 'fake', vi.fn().mockResolvedValue(new Response('detected_unusual_activity', { status: 401 })));
    expect(result).toMatchObject({ ok: false, reason: 'elevenlabs_free_tier_blocked', fallback: true });
  });
  it.each(['bad private JSON', 'null', '[]', '{"text":42}', '{"text":{}}'])('sanitizes invalid transcription payload %s', async body => {
    await expect(transcribeSpeech(file, 'fake', vi.fn().mockResolvedValue(new Response(body)))).rejects.toThrow(/^Invalid transcription response$/);
  });
  it('sanitizes transcription network errors', async () => {
    await expect(transcribeSpeech(file, 'fake', vi.fn().mockRejectedValue(new Error('private URL/key')))).rejects.toThrow(/^Transcription request failed$/);
  });
});
