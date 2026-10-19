import { describe, expect, it, vi } from 'vitest';
import { createEmailTransport, createSyntheticEmailSink } from '../../supabase/functions/_shared/email-transport';

const message = () => ({
  to: 'employee@example.test', from: 'sender@example.test',
  subject: 'Synthetic confirmation', html: '<p>Test only</p>', text: 'Test only',
  message_id: 'synthetic-message-1', idempotency_key: 'synthetic-key-1',
  unsubscribe_token: 'synthetic-token', purpose: 'transactional',
});

describe('email delivery boundary', () => {
  it('forwards the complete queue envelope unchanged and waits for delivery', async () => {
    let finish: () => void = () => {};
    const delivery = new Promise<void>((resolve) => { finish = resolve; });
    const provider = vi.fn(() => delivery);
    const payload = message();
    let settled = false;
    const sending = createEmailTransport(provider).send(payload).then(() => { settled = true; });
    expect(provider).toHaveBeenCalledExactlyOnceWith(payload);
    await Promise.resolve();
    expect(settled).toBe(false);
    finish();
    await sending;
    expect(settled).toBe(true);
  });

  it.each([429, 403, 500])('preserves provider error %s and retry metadata without retrying', async (status) => {
    const error = Object.assign(new Error('Synthetic provider failure'), { status, retryAfterSeconds: 120 });
    const provider = vi.fn(async () => { throw error; });
    await expect(createEmailTransport(provider).send(message())).rejects.toBe(error);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('captures synthetic mail without fetch and keeps isolated copies', async () => {
    const sink = createSyntheticEmailSink<ReturnType<typeof message>>();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
    try {
      const payload = message();
      await sink.transport.send(payload);
      payload.subject = 'mutated';
      expect(sink.messages()[0].subject).toBe('Synthetic confirmation');
      const copy = sink.messages(); copy[0].subject = 'changed again';
      expect(sink.messages()[0].subject).toBe('Synthetic confirmation');
      expect(fetchSpy).not.toHaveBeenCalled();
      sink.clear();
      expect(sink.messages()).toEqual([]);
    } finally { fetchSpy.mockRestore(); }
  });

  it.each(['employee@example.com', 'one@example.test,two@example.test', 'Name <one@example.test>', 'one@example.test\r\nBcc: other@example.com'])('rejects non-synthetic or ambiguous recipient %s', async (to) => {
    const sink = createSyntheticEmailSink();
    await expect(sink.transport.send({ to })).rejects.toThrow('single .test recipient');
    expect(sink.messages()).toEqual([]);
  });
});
