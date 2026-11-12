// Reusable route shim: runs server-function handlers in Node for browser and Node tests.
// The local Edge runtime is disabled, so the page's /functions/v1/<name> calls are answered by
// the exact handler module (e.g. createCallerHandler from supabase/functions/_shared/caller-handler.ts)
// talking to the real local Auth/REST. This proves handler logic, not the Deno gateway.
//
// Not a spec file: Playwright's default testMatch only collects *.spec|test.* files.

export const LOCAL_ORIGINS = ['http://127.0.0.1:8082', 'http://127.0.0.1:55321'];

/**
 * Playwright route callback. Non-local origins are aborted (nothing reaches production or the
 * internet), /functions/v1/<name> runs handlers[name], any other local request continues.
 * An unshimmed function gets 501 so a test never silently depends on a missing runtime.
 * @param {Record<string, (req: Request) => Promise<Response>>} handlers
 * @param {{ allowedOrigins?: string[] }} [options]
 */
export function edgeRoute(handlers, { allowedOrigins = LOCAL_ORIGINS } = {}) {
  return async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!allowedOrigins.includes(url.origin)) return route.abort();
    const match = /^\/functions\/v1\/([^/]+)$/.exec(url.pathname);
    if (!match) return route.continue();
    const handler = handlers[match[1]];
    if (!handler) {
      return route.fulfill({
        status: 501, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ error: `No local shim for ${match[1]}` }),
      });
    }
    const method = request.method();
    const body = method === 'GET' || method === 'HEAD' ? undefined : request.postData() ?? undefined;
    const response = await handler(new Request(url, { method, headers: request.headers(), body }));
    return route.fulfill({
      status: response.status, headers: Object.fromEntries(response.headers), body: await response.text(),
    });
  };
}

/**
 * Registers the shim on a Playwright BrowserContext (replaces a spec's own origin filter).
 * @param {{ route: (pattern: string, fn: (route: unknown) => unknown) => Promise<void> }} context
 * @param {Record<string, (req: Request) => Promise<Response>>} handlers
 * @param {{ allowedOrigins?: string[] }} [options]
 */
export async function installEdgeShim(context, handlers, options) {
  await context.route('**/*', edgeRoute(handlers, options));
}

/**
 * Calls a handler directly from a Node test (scripts/local-*.mjs) as a signed-in caller.
 * @param {(req: Request) => Promise<Response>} handler
 * @param {{ name: string, token?: string, body?: unknown, baseUrl?: string, method?: string }} call
 * @returns {Promise<{ status: number, body: unknown }>}
 */
export async function callHandler(handler, { name, token, body = {}, baseUrl = 'http://127.0.0.1:55321', method = 'POST' }) {
  const response = await handler(new Request(`${baseUrl}/functions/v1/${name}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  }));
  const text = await response.text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch { /* keep raw text */ }
  return { status: response.status, body: parsed };
}

/**
 * Email sink for tests: records every message and never sends anything. `fail: true` simulates
 * a refused queue so the "email not queued" path can be exercised.
 * @param {{ fail?: boolean }} [options]
 */
export function recordingEmailSink({ fail = false } = {}) {
  const messages = [];
  const sink = async message => {
    messages.push(message);
    return fail ? 'failed' : 'queued';
  };
  sink.messages = messages;
  return sink;
}
