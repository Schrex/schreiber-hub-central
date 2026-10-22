# Delivery-time email safeguards

> Historical migration record. For current production identity and operating rules,
> use [production baseline](production-baseline.md). Do not rerun migration steps
> or treat earlier pending-state descriptions as current status.

## Consolidated status — October 22, 2026

The design notes below describe an earlier implementation stage. Retained later
proof covers Postmark inbox delivery, the verified suppression webhook and synthetic
unsubscribe/replay. Current unsubscribe code persists suppression before consuming
the token; the worker checks success-log and queue-operation errors.

Automatic delivery remains OFF; dispatcher installation/proof and business-recipient
review remain unresolved. A 30-second visibility lease and uncertain provider/log
outcomes still permit duplicate delivery; no exactly-once claim is made. Email OFF
does not suppress database-generated in-app notifications, and Auth SMTP is separate.
See [development progress](../DEVELOPMENT_PROGRESS.md) for consolidated evidence.

**Review status:** optional companion runtime work, not part of the audit-only PR.
Further delivery-tracking infrastructure is paused. Current plan: Supabase Auth
SMTP and the existing notification queue; this module is not an activation gate
for DNS verification or Auth SMTP testing.

Implemented locally on 2026-10-19; no deployment, provider request, or real queue
operation. The worker's provider remains Lovable. Postmark is still standalone.

Immediately before provider delivery, the worker now checks the current suppression
record, rather than trusting the older enqueue decision. Transactional mail is
blocked by any suppression reason or a used unsubscribe token. The latter covers
the existing non-atomic unsubscribe failure where the token was marked used but
suppression-row creation failed. Lookup uses normalized recipient email, not a
possibly absent or stale token carried in the queue payload.

Auth mail deliberately ignores marketing unsubscribe and used unsubscribe tokens,
so unsubscribe does not cut off password reset/access mail. Bounce, complaint and
unknown suppression reasons block both queues. This is application policy; the
provider can independently suppress a recipient. No provider-side suppression was
cleared. Queue identity determines Auth classification, never caller purpose text.

Lookup errors/exceptions fail closed: no delivery, deletion, provider-failure log
or failed-attempt increment; the message remains until queue visibility expires.
Malformed/multiple recipients and unknown queue types defer similarly. Ordinary
TTL/retry preflight still applies on a later attempt. This is not an indefinite
retention guarantee for expired messages.

For confirmed suppression, the worker first writes a `suppressed` delivery-log
entry and then removes the queued message. A log failure leaves it queued; a
removal failure also leaves it for rechecking. No `sent` entry is fabricated.
These two operations are not atomic and repeated suppressed audit entries remain
possible. New operational logs contain queue/id/reason only, not recipients,
unsubscribe tokens or raw database error payloads.

Failed-attempt-counter lookup and duplicate-sent lookup errors now return 503 and
stop the remaining batch before further delivery. Claimed messages remain queued;
messages successfully delivered earlier in the batch are not rolled back. The
existing check-then-send duplicate guard still has a concurrency race; durable
claims/provider receipt reconciliation remain separate gates.

Eighteen dependency-injected synthetic cases cover normalized lookup, each reason,
used-token fallback, Auth exception, fail-closed database errors/exceptions, malformed
recipients and unknown queues. No network/database calls occur in these tests.
The handler's database log/delete and early-return branches are statically checked,
not database integration tested by this suite.

```sh
bun run test src/test/emailDeliveryGuard.test.ts
```

No migration or permission change was added. Remaining validation includes synthetic
handler/DB failure injection, concurrent unsubscribe/delivery race, durable send
claim/reconciliation, provider webhook ingestion and actual Auth/transactional
policy review before activation. A suppression inserted after the final lookup
can still race with delivery; this guard narrows the gap rather than claiming
transactional delivery exclusion.

## Remaining durable-delivery work

Read-only review confirms the current 30-second visibility lease covers the entire
sequential batch; provider calls can outlast it. The unique `sent` log index only
rejects a second log after delivery, not a second outbound request. A durable
exclusive claim and uncertain-outcome hold are still required before Postmark use.
Receipt persistence must precede queue acknowledgement; the current Lovable path
still ignores success-log insertion errors. Existing metadata can store receipts
but does not establish a claim protocol. Enqueue creates a new message ID for each
request despite accepting an idempotency key, so cross-request deduplication also
needs design and tests. Do not treat Postmark correlation metadata as idempotency.

The repository's queue RPC omits `enqueued_at` from its result even though the worker
uses it as a missing-payload timestamp fallback. Export/live schema verification
and timestamp validation remain gates. Applied migrations were not changed.

The new local database test (`bun run test:local:email-guard`, included in backend
verification) exercises real suppression/token reads and rate-limit log persistence.
It does not execute the worker, queue RPCs, provider requests or concurrency scenarios.

The initial cooldown-state read also fails closed on database error or missing
state before any queue reads. HTTP429 audit entries now use existing-schema
`status=pending` plus metadata `outcome=rate_limited` and `retry_after_seconds`;
no unsupported `rate_limited` status is inserted and the failed-attempt query
continues to exclude rate limiting. Audit insert or cooldown update failure stops
the batch with 503 and preserves queued messages. A synthetic regression checks
that classified rate limiting becomes this pending record. No schema change.
