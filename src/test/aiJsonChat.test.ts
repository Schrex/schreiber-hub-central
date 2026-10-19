import { describe, it, expect, vi } from 'vitest';
import { AiHttpError, optionalAiText, requestJsonChat, type JsonChatRequest } from '../../supabase/functions/_shared/ai-json-chat.ts';

const request: JsonChatRequest = {
  endpoint: 'https://synthetic-provider.invalid/v1/chat/completions',
  apiKey: 'synthetic-key', model: 'synthetic-model',
  messages: [{ role: 'system', content: 'Synthetic instruction' }, { role: 'user', content: 'Synthetic crew task' }],
};
const completion = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }));
describe('AI JSON chat boundary (fake fetch only)', () => {
  it('preserves POST/auth/model/messages/json-object contract and returns valid content', async () => {
    const result = { match_talk_id: null, suggested_topic: 'Excavation checks', reasoning: 'Synthetic reason' };
    const fake = vi.fn().mockResolvedValue(completion(JSON.stringify(result)));
    expect(await requestJsonChat(request, fake)).toEqual(result);
    expect(fake).toHaveBeenCalledExactlyOnceWith(request.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-key' },
      body: JSON.stringify({ model: request.model, messages: request.messages, response_format: { type: 'json_object' } }),
    });
  });
  it.each([402, 429, 401, 500])('retains HTTP status %s without exposing provider body', async status => {
    const error = await requestJsonChat(request, vi.fn().mockResolvedValue(new Response('sensitive provider body', { status }))).catch(e => e);
    expect(error).toBeInstanceOf(AiHttpError);
    expect(error.status).toBe(status);
    expect(error.message).toBe(`AI error ${status}`);
  });
  it.each(['not-json', '{}', '{"choices":[]}', '{"choices":[{"message":{}}]}', '{"choices":[{"message":{"content":42}}]}'])('rejects malformed envelope %s', async body => {
    await expect(requestJsonChat(request, vi.fn().mockResolvedValue(new Response(body)))).rejects.toThrow('Invalid AI response');
  });
  it.each(['bad private output', 'null', '[]', '42', '"text"'])('rejects malformed/non-object content %s', async content => {
    await expect(requestJsonChat(request, vi.fn().mockResolvedValue(completion(content)))).rejects.toThrow('Invalid AI response');
  });
  it('sanitizes transport failures', async () => {
    await expect(requestJsonChat(request, vi.fn().mockRejectedValue(new Error('private URL/token')))).rejects.toThrow(/^AI request failed$/);
  });
  it('preserves missing/null/text fields but rejects unexpected field types', () => {
    expect(optionalAiText(undefined)).toBeNull();
    expect(optionalAiText(null)).toBeNull();
    expect(optionalAiText('')).toBe('');
    expect(optionalAiText('topic')).toBe('topic');
    for (const value of [false, 7, {}, []]) expect(() => optionalAiText(value)).toThrow('Invalid AI response');
  });
});
