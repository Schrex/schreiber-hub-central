/** Provider-neutral delivery seam. Queue state/retries remain the worker's responsibility. */
export interface EmailTransport<Message> {
  send(message: Message): Promise<void>;
}

/** Preserve provider errors (including status and retryAfterSeconds) for queue policy. */
export function createEmailTransport<Message>(
  deliver: (message: Message) => Promise<unknown>,
): EmailTransport<Message> {
  return {
    async send(message) {
      await deliver(message);
    },
  };
}

/**
 * In-memory synthetic test sink. Deliberately not selectable by a deployed worker's
 * environment: treating captured mail as sent would drain real restored queues.
 * No network, console output, disk persistence, or recipient rewriting.
 */
export function createSyntheticEmailSink<Message extends { to: string }>() {
  const captured: Message[] = [];
  const transport: EmailTransport<Message> = {
    async send(message) {
      if (typeof message.to !== 'string' || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.test$/i.test(message.to)) {
        throw new Error('Synthetic email sink accepts only a single .test recipient');
      }
      captured.push(structuredClone(message));
    },
  };
  return {
    transport,
    messages: (): Message[] => structuredClone(captured),
    clear: () => { captured.length = 0; },
  };
}
