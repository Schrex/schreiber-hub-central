import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

type Result = { data?: unknown; error: unknown };
type Operation = { table: string; action: string; values?: unknown; filters: Record<string, unknown> };
function harness(name: string, resolve: (op: Operation) => Result, overrides: Record<string, string> = {}) {
  const operations: Operation[] = [];
  const deliver = vi.fn().mockResolvedValue({ kind: 'accepted' });
  const env: Record<string, string> = {
    EMAIL_PROVIDER: 'postmark', POSTMARK_SERVER_TOKEN: 'synthetic-provider',
    SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service',
    POSTMARK_FROM: 'sender@example.test', EMAIL_DELIVERY_ENABLED: 'true',
    EMAIL_ALLOWED_RECIPIENTS: 'owner@example.test', ...overrides,
  };
  const client = {
    from(table: string) {
      const op: Operation = { table, action: 'select', filters: {} };
      const query = {
        select() { return query; },
        insert(values: unknown) { op.action = 'insert'; op.values = values; return query; },
        upsert(values: unknown) { op.action = 'upsert'; op.values = values; return query; },
        update(values: unknown) { op.action = 'update'; op.values = values; return query; },
        eq(key: string, value: unknown) { op.filters[key] = value; return query; },
        is(key: string, value: unknown) { op.filters[key] = value; return query; },
        in(key: string, value: unknown) { op.filters[key] = value; return query; },
        single() { return query; }, maybeSingle() { return query; },
        then(onfulfilled: (r: Result) => unknown, onrejected?: (e: unknown) => unknown) {
          operations.push(op);
          return Promise.resolve().then(() => resolve(op)).then(onfulfilled, onrejected);
        },
      };
      return query;
    },
    rpc(table: string, values: unknown) {
      const op = { table, action: 'rpc', values, filters: {} };
      operations.push(op);
      return Promise.resolve().then(() => resolve(op));
    },
  };
  const createClient = vi.fn(() => client);
  let handler!: (req: Request) => Promise<Response>;
  const source = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8').replace(/^import .*\n/gm, '');
  // Execute the real entry point with synthetic dependencies; never load Deno or network SDKs.
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new Function('Deno', 'createClient', 'createPostmarkAdapter', 'sendLovableEmail', compiled)(
    { env: { get: (key: string) => env[key] }, serve: (fn: typeof handler) => { handler = fn; } },
    createClient, () => ({ deliver }), vi.fn(),
  );
  return { operations, deliver, createClient, request: (token = 'synthetic-service', method = 'POST') => handler(new Request(
    'https://example.test?token=synthetic-unsubscribe', { method, headers: token ? { Authorization: `Bearer ${token}` } : {} },
  )) };
}
const message = { msg_id: 1, enqueued_at: new Date().toISOString(), message: { message_id: 'synthetic-message', to: 'owner@example.test' } };
const normal = (op: Operation): Result => ({ error: null, data:
  op.table === 'email_send_state' ? { send_delay_ms: 0 } :
  op.table === 'read_email_batch' ? [message] :
  op.table === 'email_send_log' && op.filters.status === 'failed' ? [] : null });

describe('queue worker reliability boundaries', () => {
  it.each(['', 'ordinary-user-jwt', 'x.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.forged'])('rejects unauthorized credential %s before database access', async token => {
    const h = harness('process-email-queue', normal);
    expect((await h.request(token)).status).toBe(token ? 403 : 401);
    expect(h.operations).toEqual([]); expect(h.createClient).not.toHaveBeenCalled(); expect(h.deliver).not.toHaveBeenCalled();
  });
  it('delivery disabled has no queue or log effects', async () => {
    const h = harness('process-email-queue', normal, { EMAIL_DELIVERY_ENABLED: 'false' });
    expect(await (await h.request()).json()).toMatchObject({ skipped: true });
    expect(h.operations).toEqual([]);
  });
  it('requires controlled recipient configuration before claiming queues', async () => {
    const h = harness('process-email-queue', normal, { EMAIL_ALLOWED_RECIPIENTS: '' });
    expect((await h.request()).status).toBe(503); expect(h.operations).toEqual([]);
  });
  it.each(['other@example.test', 'owner@example.test,other@example.test'])('leaves unapproved recipient %s untouched even after expiry', async recipient => {
    const h = harness('process-email-queue', op => op.table === 'read_email_batch'
      ? { error: null, data: [{ ...message, enqueued_at: '2000-01-01', message: { ...message.message, to: recipient } }] } : normal(op));
    expect((await h.request()).status).toBe(200); expect(h.deliver).not.toHaveBeenCalled();
    expect(h.operations.some(op => ['delete_email', 'move_to_dlq'].includes(op.table) || op.action === 'insert')).toBe(false);
  });
  it('sends approved mail, records success and deletes it', async () => {
    const h = harness('process-email-queue', normal);
    expect(await (await h.request()).json()).toEqual({ processed: 1, failed: 0 });
    expect(h.deliver).toHaveBeenCalledTimes(1);
    expect(h.operations.at(-1)?.table).toBe('delete_email');
  });
  it.each(['email_send_state', 'read_email_batch', 'failed', 'sent', 'suppressed_emails', 'insert', 'delete_email'])('propagates %s database failure as 503', async failure => {
    const h = harness('process-email-queue', op => op.table === failure || op.filters.status === failure || op.action === failure
      ? { error: { message: 'synthetic DB failure' } } : normal(op));
    expect((await h.request()).status).toBe(503);
    expect(h.operations.filter(op => op.action === 'insert' && (op.values as { status: string }).status === 'failed')).toHaveLength(0);
  });
  it('reports provider uncertainty as a retryable failure without deleting the message', async () => {
    const h = harness('process-email-queue', normal);
    h.deliver.mockResolvedValue({ kind: 'ambiguous' });
    const response = await h.request();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ processed: 0, failed: 1 });
    expect(h.operations.some(op => op.table === 'delete_email')).toBe(false);
  });
  it('reports cooldown persistence failure after rate limiting', async () => {
    const h = harness('process-email-queue', op => op.action === 'update' ? { error: {} } : normal(op));
    h.deliver.mockResolvedValue({ kind: 'rate_limited', retryAfterSeconds: 60 });
    expect((await h.request()).status).toBe(503);
    expect(h.operations.some(op => op.table === 'delete_email')).toBe(false);
  });
  it('propagates DLQ failure and does not attempt provider delivery', async () => {
    const h = harness('process-email-queue', op => op.table === 'read_email_batch'
      ? { error: null, data: [{ ...message, enqueued_at: '2000-01-01' }] }
      : op.table === 'move_to_dlq' ? { error: {} } : normal(op));
    expect((await h.request()).status).toBe(503); expect(h.deliver).not.toHaveBeenCalled();
  });
});

describe('retry-safe unsubscribe', () => {
  it('does not consume token if suppression fails, then succeeds on retry', async () => {
    let fail = true;
    const h = harness('handle-email-unsubscribe', op => op.action === 'select'
      ? { error: null, data: { email: 'owner@example.test', used_at: null } }
      : { error: op.action === 'upsert' && fail ? {} : null });
    expect((await h.request()).status).toBe(503);
    expect(h.operations.some(op => op.action === 'update')).toBe(false);
    fail = false;
    expect(await (await h.request()).json()).toEqual({ success: true });
    expect(h.operations.slice(-2).map(op => op.action)).toEqual(['upsert', 'update']);
  });
  it('repairs previously consumed tokens and safely retries a failed used_at write', async () => {
    let fail = true;
    const h = harness('handle-email-unsubscribe', op => op.action === 'select'
      ? { error: null, data: { email: 'owner@example.test', used_at: '2026-01-01' } }
      : { error: op.action === 'update' && fail ? {} : null });
    expect((await h.request()).status).toBe(503); fail = false;
    expect(await (await h.request()).json()).toEqual({ success: true });
    expect(h.operations.filter(op => op.action === 'upsert')).toHaveLength(2);
  });
  it('GET validation does not mutate suppression or token', async () => {
    const h = harness('handle-email-unsubscribe', () => ({ error: null, data: { email: 'owner@example.test', used_at: null } }));
    expect(await (await h.request('', 'GET')).json()).toEqual({ valid: true });
    expect(h.operations.map(op => op.action)).toEqual(['select']);
  });
});
