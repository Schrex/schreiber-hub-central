# Email replacement preparation

Prepared 2026-10-19 on the migration feature branch. No provider request, secret
lookup, deployment, hosted setting change or real message was sent in this work.

## Implemented boundary and synthetic sink

`supabase/functions/_shared/email-transport.ts` introduces an injected delivery
interface independent of SDKs, environment variables and database operations.
`process-email-queue` now sends through that interface, still backed by the same
Lovable SDK, `LOVABLE_API_KEY` and optional `LOVABLE_SEND_URL`. The full existing
payload is forwarded unchanged, including message/idempotency IDs and unsubscribe
token. Structured errors pass through unchanged so the worker's existing 429
cooldown, 403 dead-letter behavior and ordinary failed-attempt logic still apply.
No extra transport retries are added.

The module also supplies an in-memory sink for synthetic tests. It accepts one
reserved `.test` email recipient, rejects ordinary domains and ambiguous recipient
lists, captures a copy without network/log/file output, returns independent copies
for assertions and supports clearing captured state. It is intentionally not an
`EMAIL_TRANSPORT=sink` runtime setting: marking captured real messages as sent
would remove them from a restored queue. Rehearsal queues must remain inert.

This is a seam for a future provider adapter, not a completed mail migration.
No replacement vendor was chosen or integrated. The deployed app is unchanged.

## Tests and remaining gates

Nine synthetic Vitest cases cover waiting for delivery, complete unchanged payload
forwarding, no internal retries, preserving 429/403/500 error identity and metadata,
network-free sink capture, defensive copies, clearing and rejection of real or
ambiguous recipient addresses. Run:

```sh
bun run test src/test/emailTransport.test.ts
```

The initial explicit worker check filled a gap in the existing Edge list. Parent
integration now includes `process-email-queue` in `verify:edge`; standalone command:

```sh
npx --yes deno@2.5.6 check --no-lock --node-modules-dir=none supabase/functions/process-email-queue/index.ts
```

The tests do not execute the deployed handler, database queue, templates or Auth
hook. Worker deduplication/concurrency, retries, expiration, DLQ operations and
suppression handling need database-backed synthetic tests before switching a
provider. The transport does not add suppression enforcement or solve existing
worker behavior; the future provider path must explicitly preserve these controls.

Before live delivery: select provider/company owner, verify sender domain and DNS,
implement provider adapter and webhook signatures/events, test idempotency and
error mapping, preserve suppression/unsubscribe state, inventory actual Auth
hook/SMTP flow, and exercise synthetic confirmation/reset and transactional mail.
Keep private credentials outside Git and never test against employee recipients.
No production rollout or migration cutover is authorized by this preparation.

Validation completed: `verify:app` passed (typecheck, 28 tests including the nine
email cases, build); `verify:lint` passed with the existing 30 warnings;
`verify:edge` and the explicit queue-worker Deno check passed. The first worker
check exposed existing generic-client/callback typing errors; an inferred client
factory and narrow message-ID callback annotations fixed them without changing
queue behavior. Focused ESLint and whitespace checks passed after that fix.
Package resolution initially failed in the restricted network environment; the
static checks succeeded with approved tooling network access. No handler ran.

## Second preparation step: queue decision regression coverage

`_shared/email-queue-policy.ts` now holds the worker's pure preflight and failure
classification decisions. The deployed-handler source consumes these helpers;
this is not a test-only copy. Twenty additional synthetic cases cover exact TTL
boundaries, independent Auth/transactional TTLs, the actual-failure retry boundary,
TTL-before-retry precedence, 429 retry-after defaults and explicit zero, structured
403 responses, legacy SDK errors, structured-status precedence, and existing
missing/malformed timestamp and error handling. Together with delivery-boundary
tests there are 29 email tests.

The extraction preserves existing behavior deliberately. Invalid timestamps still
do not cause expiry, legacy error message matching is still a fallback, malformed
structured status does not fall back to message matching, and retry-after values
are not newly normalized. These compatibility cases expose existing behavior;
they are not claims that malformed inputs are validated or safe for every provider.
A future adapter must define its error contract explicitly.

Queue database reads/writes, concurrent duplicate claims, transport failures after
actual delivery, suppression, template rendering, Auth hooks and provider webhook
verification remain outside this pure coverage. No real queue was drained and
no live delivery or deploy occurred.

Second-step validation: focused email tests 29/29, full `verify:app` passed with
57 tests across the concurrently prepared checkout, `verify:edge` passed including
the queue worker, `verify:lint` passed with 30 existing warnings, and whitespace
checks passed. No database-backed queue test was run for this extraction.

## Third preparation step: unsubscribe compatibility and blockers

Extracted the existing request-token reader into
`_shared/email-unsubscribe-token.ts`, used by the unsubscribe handler. Eleven
synthetic Request cases cover GET decoding, JSON/form token precedence, RFC8058
one-click using the URL token even with a conflicting body token, missing URL
tokens, malformed/empty JSON fallback, empty form fallback and charset handling.
No routing, response status or database operation changed. The token-update error
log now emits the database error code only, removing the bearer-like unsubscribe
token and full error payload from that log path.

Specific migration blockers found by source review:

- Suppression webhook verification still uses the Lovable SDK and Lovable API key.
  A replacement must map its signed bounce/complaint/unsubscribe events and enforce
  replay/timestamp checks. The current payload parser checks only field truthiness,
  not email type or allowed reason. New provider payloads cannot be passed through
  on the assumption that this interface validates them completely.
- Unsubscribe marks the token used before writing `suppressed_emails`, in two
  separate database operations. If the latter fails, retries report already used
  without repairing the row. The enqueue handler separately rejects used tokens,
  which mitigates newly enqueued transactional mail, but does not make these writes
  atomic or repair restored inconsistent state. A transactional database operation
  needs a separately reviewed migration; no migration was added here.
- Transactional enqueue checks suppression, while the queue worker does not recheck
  it at delivery. Mail queued before a suppression may therefore reach the existing
  provider. The source provider's additional suppression behavior is unverified;
  do not assume a replacement transport inherits it. Define handling separately
  for transactional versus Auth mail and add database-backed coverage before switch.
- Suppression retries upsert the recipient but append another delivery-log event;
  repeated events are not deduplicated as audit entries. Preserve existing logs
  and define provider event identity before changing that behavior.
- The token reader retains legacy loose JSON token typing and does not impose body
  limits. Request compatibility tests do not prove hostile-input validation,
  signature correctness, actual unsubscribe database effects or delivery prevention.

No production mutation, provider call, queue draining or database write occurred.
