import { describe, expect, it } from "vitest";
import { callHandler, edgeRoute, installEdgeShim, recordingEmailSink } from "../../e2e/support/edgeShim.mjs";

// Minimal stand-in for a Playwright Route: records which of abort/continue/fulfill was used.
function fakeRoute(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  const outcome: { kind?: string; status?: number; headers?: Record<string, string>; body?: string } = {};
  const route = {
    request: () => ({
      url: () => url, method: () => init.method ?? "GET",
      headers: () => init.headers ?? {}, postData: () => init.body ?? null,
    }),
    abort: async () => { outcome.kind = "abort"; },
    continue: async () => { outcome.kind = "continue"; },
    fulfill: async (r: { status: number; headers: Record<string, string>; body: string }) => {
      Object.assign(outcome, { kind: "fulfill", ...r });
    },
  };
  return { route, outcome };
}

const echo = async (req: Request) => new Response(JSON.stringify({
  method: req.method, auth: req.headers.get("authorization"), body: req.method === "POST" ? await req.json() : null,
}), { status: 201, headers: { "Content-Type": "application/json" } });

describe("browser-test route shim for server functions", () => {
  it("runs the named handler in Node and returns its response to the page", async () => {
    const { route, outcome } = fakeRoute("http://127.0.0.1:55321/functions/v1/time-off-submit", {
      method: "POST", headers: { authorization: "Bearer synthetic" }, body: JSON.stringify({ hours: 8 }),
    });
    await edgeRoute({ "time-off-submit": echo })(route);
    expect(outcome.kind).toBe("fulfill");
    expect(outcome.status).toBe(201);
    expect(JSON.parse(outcome.body!)).toEqual({ method: "POST", auth: "Bearer synthetic", body: { hours: 8 } });
    expect(outcome.headers!["content-type"]).toBe("application/json");
  });

  it("passes other local requests through and blocks every non-local origin", async () => {
    const local = fakeRoute("http://127.0.0.1:55321/rest/v1/time_off_requests");
    await edgeRoute({ "time-off-submit": echo })(local.route);
    expect(local.outcome.kind).toBe("continue");
    const app = fakeRoute("http://127.0.0.1:8082/time-off");
    await edgeRoute({})(app.route);
    expect(app.outcome.kind).toBe("continue");
    const remote = fakeRoute("https://acgqjjbrnkmeazswdnzp.supabase.co/functions/v1/time-off-submit");
    await edgeRoute({ "time-off-submit": echo })(remote.route);
    expect(remote.outcome.kind).toBe("abort");
  });

  it("answers an unshimmed local function with 501 instead of reaching a disabled Edge runtime", async () => {
    const { route, outcome } = fakeRoute("http://127.0.0.1:55321/functions/v1/send-transactional-email", { method: "POST", body: "{}" });
    await edgeRoute({})(route);
    expect(outcome.kind).toBe("fulfill");
    expect(outcome.status).toBe(501);
  });

  it("installs on a browser context for every URL", async () => {
    const calls: [string, unknown][] = [];
    await installEdgeShim({ route: async (pattern: string, fn: unknown) => { calls.push([pattern, fn]); } }, { x: echo });
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("**/*");
  });

  it("calls a handler directly from Node tests with a bearer token", async () => {
    expect(await callHandler(echo, { name: "time-off-submit", token: "synthetic", body: { a: 1 } }))
      .toEqual({ status: 201, body: { method: "POST", auth: "Bearer synthetic", body: { a: 1 } } });
  });

  it("records queued emails and can simulate a queue failure", async () => {
    const sink = recordingEmailSink();
    const message = { templateName: "t", recipientEmail: "a@example.test", idempotencyKey: "k", templateData: {} };
    expect(await sink(message)).toBe("queued");
    expect(sink.messages).toEqual([message]);
    const failing = recordingEmailSink({ fail: true });
    expect(await failing(message)).toBe("failed");
    expect(failing.messages).toEqual([message]);
  });
});
