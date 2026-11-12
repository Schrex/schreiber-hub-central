import { describe, expect, it } from "vitest";
import {
  createCallerHandler, pickActiveAdminRecipients, timeOffIdempotencyKey, type EmailMessage,
} from "../../supabase/functions/_shared/caller-handler";

const config = { url: "http://127.0.0.1:55321", anonKey: "synthetic-anon", serviceKey: "synthetic-service" };
const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

function post(token?: string, body: unknown = {}) {
  return new Request("http://127.0.0.1:55321/functions/v1/time-off-test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

// Synthetic Supabase stand-in: users by token, role rows, and a record of every
// client built (key + Authorization) and every write, so tests can see who wrote.
function fakeBackend(opts: {
  users?: Record<string, string>; roles?: Record<string, string[]>;
  profiles?: { user_id: string; email: string | null; is_active: boolean; display_name: string | null }[];
  invokeResult?: { data: unknown; error: unknown };
} = {}) {
  const users = opts.users ?? {};
  const roles = opts.roles ?? {};
  const clients: { key: string; authorization?: string }[] = [];
  const writes: { key: string; table: string; values: unknown }[] = [];
  const invocations: { key: string; name: string; body: unknown }[] = [];
  const factory = (_url: string, key: string, options?: { global?: { headers?: Record<string, string> } }) => {
    const authorization = options?.global?.headers?.Authorization;
    clients.push({ key, authorization });
    const token = authorization?.replace(/^Bearer /, "");
    return {
      auth: {
        async getUser() {
          const id = token ? users[token] : undefined;
          return id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: "invalid JWT" } };
        },
      },
      functions: {
        async invoke(name: string, { body }: { body: unknown }) {
          invocations.push({ key, name, body });
          return opts.invokeResult ?? { data: { success: true, queued: true }, error: null };
        },
      },
      from(table: string) {
        const filters: Record<string, unknown> = {};
        const query = {
          select() { return query; },
          eq(column: string, value: unknown) { filters[column] = value; return query; },
          in(column: string, value: unknown) { filters[column] = value; return query; },
          insert(values: unknown) { writes.push({ key, table, values }); return query; },
          then(resolve: (r: unknown) => unknown) {
            const roleRows = Object.entries(roles).flatMap(([user_id, list]) => list.map(role => ({ user_id, role })));
            const rows = table === "user_roles"
              ? roleRows.filter(r => (filters.user_id === undefined || r.user_id === filters.user_id)
                && (filters.role === undefined || r.role === filters.role))
              : table === "profiles"
                ? (opts.profiles ?? []).filter(p => (filters.user_id as string[]).includes(p.user_id))
                : [];
            return Promise.resolve({ data: rows, error: null }).then(resolve);
          },
        };
        return query;
      },
    };
  };
  return { factory: factory as never, clients, writes, invocations };
}

describe("caller-token server function helper", () => {
  it("refuses a request with no token or an invalid token before running the handler", async () => {
    const backend = fakeBackend({ users: { "employee-token": "employee-id" } });
    let ran = false;
    const handler = createCallerHandler(backend.factory, config, async () => { ran = true; return ok(); });
    expect((await handler(post())).status).toBe(401);
    expect((await handler(post("forged-token"))).status).toBe(401);
    expect(ran).toBe(false);
  });

  it("gives the handler a client bound to the caller's token, so writes are made as the caller", async () => {
    const backend = fakeBackend({ users: { "employee-token": "employee-id" } });
    const handler = createCallerHandler(backend.factory, config, async ({ db, user, body }) => {
      await db.from("time_off_requests").insert({ user_id: user.id, ...(body as object) });
      return ok();
    });
    const response = await handler(post("employee-token", { hours: 8 }));
    expect(response.status).toBe(200);
    expect(backend.writes).toEqual([
      { key: "synthetic-anon", table: "time_off_requests", values: { user_id: "employee-id", hours: 8 } },
    ]);
    expect(backend.clients.every(c => c.key !== "synthetic-service")).toBe(true);
  });

  it("refuses non-admin callers when the function is admin-only, office included", async () => {
    const backend = fakeBackend({
      users: { employee: "e", office: "o", foreman: "f", admin: "a", both: "b" },
      roles: { e: ["employee"], o: ["office"], f: ["foreman"], a: ["admin"], b: ["office", "admin"] },
    });
    const handler = createCallerHandler(backend.factory, config, async () => ok(), { adminOnly: true });
    for (const token of ["employee", "office", "foreman"]) {
      expect((await handler(post(token))).status, token).toBe(403);
    }
    expect((await handler(post("admin"))).status).toBe(200);
    expect((await handler(post("both"))).status).toBe(200);
  });
});

describe("time-off email recipients", () => {
  it("are active admins only, one per person and address, skipping missing emails", () => {
    const roles = [
      { user_id: "a1", role: "admin" }, { user_id: "a1", role: "office" },
      { user_id: "a2", role: "admin" }, { user_id: "a2", role: "admin" },
      { user_id: "former", role: "admin" }, { user_id: "office", role: "office" },
      { user_id: "no-email", role: "admin" }, { user_id: "bad-email", role: "admin" },
      { user_id: "same-address", role: "admin" }, { user_id: "no-profile", role: "admin" },
    ];
    const profiles = [
      { user_id: "a1", email: "admin@example.test", is_active: true, display_name: "Admin One" },
      { user_id: "a2", email: "admin2@example.test", is_active: true, display_name: null },
      { user_id: "former", email: "former@example.test", is_active: false, display_name: "Former" },
      { user_id: "office", email: "office@example.test", is_active: true, display_name: "Office" },
      { user_id: "no-email", email: null, is_active: true, display_name: "No Email" },
      { user_id: "bad-email", email: "not-an-address", is_active: true, display_name: "Bad" },
      { user_id: "same-address", email: "ADMIN@example.test", is_active: true, display_name: "Shared" },
    ];
    expect(pickActiveAdminRecipients(roles, profiles)).toEqual([
      { userId: "a1", email: "admin@example.test", name: "Admin One" },
      { userId: "a2", email: "admin2@example.test", name: null },
    ]);
  });
});

describe("time-off email queuing", () => {
  it("keys every email by event, request and recipient", () => {
    expect(timeOffIdempotencyKey("requested", "req-1", "admin-1")).toBe("time-off-requested-req-1-admin-1");
    expect(timeOffIdempotencyKey("decision", "req-1", "emp-1")).not.toBe(timeOffIdempotencyKey("decision", "req-1", "emp-2"));
    expect(timeOffIdempotencyKey("decision", "req-1", "emp-1")).not.toBe(timeOffIdempotencyKey("cancelled", "req-1", "emp-1"));
    expect(timeOffIdempotencyKey("decision", "req-1", "emp-1")).not.toBe(timeOffIdempotencyKey("decision", "req-2", "emp-1"));
  });

  const message = (n: number): EmailMessage => ({
    templateName: "time-off-requested", recipientEmail: `admin${n}@example.test`,
    idempotencyKey: `time-off-requested-req-${n}`, templateData: {},
  });

  async function send(sink: (m: EmailMessage) => Promise<"queued" | "failed">, messages: EmailMessage[]) {
    const backend = fakeBackend({ users: { t: "u" } });
    const handler = createCallerHandler(backend.factory, config,
      async ({ sendEmails }) => new Response(JSON.stringify(await sendEmails(messages))), { emailSink: sink });
    return (await handler(post("t"))).json();
  }

  it("reports emailQueued only when every email was queued", async () => {
    const sent: EmailMessage[] = [];
    expect(await send(async m => { sent.push(m); return "queued"; }, [message(1), message(2)])).toEqual({ emailQueued: true });
    expect(sent).toEqual([message(1), message(2)]);
  });

  it("returns an email-not-queued flag instead of failing when the queue refuses or throws", async () => {
    let calls = 0;
    expect(await send(async () => (++calls === 1 ? "failed" : "queued"), [message(1), message(2)])).toEqual({ emailQueued: false });
    expect(calls).toBe(2); // one failure does not stop the other recipients
    expect(await send(async () => { throw new Error("queue down"); }, [message(1)])).toEqual({ emailQueued: false });
    expect(await send(async () => "queued", [])).toEqual({ emailQueued: false });
  });
});

describe("default email sink and recipient lookup", () => {
  it("use the service role only to read admins and to invoke the email function, never to write", async () => {
    const backend = fakeBackend({
      users: { t: "emp" },
      roles: { emp: ["employee"], a1: ["admin"], gone: ["admin"], o: ["office"] },
      profiles: [
        { user_id: "a1", email: "admin@example.test", is_active: true, display_name: "Admin" },
        { user_id: "gone", email: "gone@example.test", is_active: false, display_name: "Gone" },
      ],
    });
    const handler = createCallerHandler(backend.factory, config, async ({ adminRecipients, sendEmails }) => {
      const recipients = await adminRecipients();
      const result = await sendEmails(recipients.map(r => ({
        templateName: "time-off-requested", recipientEmail: r.email,
        idempotencyKey: timeOffIdempotencyKey("requested", "req-1", r.userId), templateData: {},
      })));
      return new Response(JSON.stringify({ recipients, ...result }));
    });
    expect(await (await handler(post("t"))).json()).toEqual({
      recipients: [{ userId: "a1", email: "admin@example.test", name: "Admin" }], emailQueued: true,
    });
    expect(backend.invocations).toEqual([{
      key: "synthetic-service", name: "send-transactional-email",
      body: { templateName: "time-off-requested", recipientEmail: "admin@example.test",
        idempotencyKey: "time-off-requested-req-1-a1", templateData: {} },
    }]);
    expect(backend.writes).toEqual([]);
  });

  it("treats a send-transactional-email error as not queued", async () => {
    const backend = fakeBackend({ users: { t: "emp" }, invokeResult: { data: null, error: { message: "boom" } } });
    const handler = createCallerHandler(backend.factory, config, async ({ sendEmails }) => new Response(JSON.stringify(
      await sendEmails([{ templateName: "x", recipientEmail: "a@example.test", idempotencyKey: "k", templateData: {} }]))));
    expect(await (await handler(post("t"))).json()).toEqual({ emailQueued: false });
  });
});
