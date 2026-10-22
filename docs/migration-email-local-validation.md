# Email guard local database validation — 2026-10-19

> Historical migration record. For current production identity and operating rules,
> use [production baseline](production-baseline.md). Do not rerun migration steps
> or treat earlier pending-state descriptions as current status.

`node scripts/local-email-delivery-guard.mjs` passes against the existing synthetic
`schreiber-local` backend. The script obtains credentials through `localStatus`,
which rejects every API origin except `http://127.0.0.1:55321`. It accepts no external
target configuration and accesses no hosted project, employee data or mail provider.

## What was exercised

The actual `checkEmailDelivery` implementation queries local REST through a service
client and the existing `suppressed_emails` and `email_unsubscribe_tokens` tables.
Twenty-four combinations pass:

- No suppression, unsubscribe, bounce or complaint record.
- No unsubscribe token, unused token or used token.
- Auth and transactional queues, including uppercase input normalization.

Transactional delivery is blocked by any suppression reason or a used token. Auth
access/reset mail ignores an unsubscribe preference but is blocked by bounce or
complaint. All expected outcomes are asserted. Unknown suppression reasons remain
unit-test coverage because the existing database constraint permits only the three
recognized reasons; no constraints were changed to manufacture extra states.

Real REST lookup failures (a deliberately nonexistent relation used only for the
failing lookup) return `defer/lookup_failed`. No schema or permissions are changed.

The actual `rateLimitLogFields(60)` helper successfully inserts an existing-schema
`pending` log with rate-limit metadata. Two synthetic failed-attempt records remain
exactly two after that insert, matching the worker's failed-status counting query.
The persisted metadata is read back and compared. The invalid `rate_limited` status
is not inserted and no CHECK constraint or migration is changed.

Unique `.test` recipient/token/log fixtures are cleaned in `finally`, using only the
created recipient/message identifiers. No reset, actual queued message, wake trigger,
queue drain, send call or shared cooldown update is performed. Existing synthetic
records are preserved.

## Validation and limits

Commands passed:

```sh
node --check scripts/local-email-delivery-guard.mjs
bunx --no-install eslint scripts/local-email-delivery-guard.mjs
node scripts/local-email-delivery-guard.mjs
git diff --check
```

Bun/Node pins remain those already verified in the synthetic workstream (1.3.14 and
26.8.2). Local Docker/loopback access used approved sandbox escalation. The final run
uses both actual guard and rate-limit helpers, not a reimplementation of those
functions. Parent integration adds `test:local:email-guard` to package scripts and
the backend verification group; that package command was also run successfully.

These are database-backed policy and log-schema checks, not a served queue-worker
integration test. They do not prove atomic suppression-versus-send ordering,
concurrent claim ownership, durable provider receipts, ambiguous-send reconciliation,
queue deletion/retry correctness, actual Auth-mail classification, remote schema
parity or Postmark activation readiness. Provider calls remain disabled/unselected
as documented in the related workstreams. Complete exports and live-schema review
are still necessary before real-data restoration or activation.
