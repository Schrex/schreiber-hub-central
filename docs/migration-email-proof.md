# Controlled email proof and inactive dispatcher

## Consolidated status — October 22, 2026

Retained evidence confirms one approved-inbox enqueue/worker/Postmark delivery,
verified suppression webhook configuration and synthetic unsubscribe/replay checks.
Automatic application email remains OFF at the last confirmed state. Business-producer
acceptance, effective-recipient review, inactive dispatcher installation/proof and
old credential retirement remain unresolved; Auth SMTP is a separate path.

Historical pending statements below do not override completed evidence. Do not
repeat sends or webhook setup merely because an older section says pending. Source
now handles notification enqueue failures separately from saved business work.
See [development progress](../DEVELOPMENT_PROGRESS.md) for consolidated limits.

Updated October 20, 2026. Single-recipient inbox proof completed.

Approved recipient sumanth@schrex.com confirmed inbox receipt. Enqueue, worker
processing and one sent log correlated; final transactional/DLQ queues are empty.
Controlled allowlist remains limited to that inbox and delivery is OFF. Dispatcher
candidate is locally validated but not installed or activated. No employee fan-out
was tested. See DEVELOPMENT_PROGRESS.md for retained rejection history and fixes.
Postmark SubscriptionChange webhook 26048997 is configured and visibly Verified;
synthetic authentication/replay and unsubscribe checks passed. Real business-producer
acceptance and private owner review of eventual recipient settings remain separate.

Parent execution plan: [migration-completion-plan.md](migration-completion-plan.md).
Only the coordinator performs hosted mutations. Keep source, DNS and production
unchanged. No employee records or restored messages are test fixtures.

## Recipient and link review

Reviewed current registry, producer handlers, TimeOff page and worker source:

| Essential | Actual email destination | Links / limitations |
| --- | --- | --- |
| Login/recovery | Supabase Auth SMTP sends to the requesting account; separate from transactional worker | Retest redirect/recovery on independent host. Worker off switch does not disable Auth SMTP. |
| Jobs and files | No dedicated notification template in the registry for ordinary saves/uploads | Their acceptance is persisted state/private access, not this mail proof. |
| Time off approval | Profiles for admin/foreman plus current Equipment Manager positions, union by user ID | No app link. Separate users sharing an address can receive duplicates. Client ignores resolved function errors, so approval toast alone does not prove enqueue. |
| Truck request | app_settings.office_dispatch_email string or object.email; fallback office@schrex.com | Template's optional approveUrl omitted by current producer; no button currently emitted. |
| Truck decision | Requester's profile email | No app link. |
| Accident/violation | Distinct profile email values for office/admin roles | No app link; accident reportUrl prop unused. Handlers currently do not inspect success:false payloads. |
| Inspection | app_settings.york_safety_email string or object.email; fallback external info@yorksafetysolutions.com | No app link; external recipient must be reviewed before activation. |

No current template sets `to`. Enqueue nevertheless gives `template.to` precedence
over recipientEmail; recheck this before proof if registry changes. PreviewData is
not automatically merged into runtime templateData. Deferred new-hire template has
placeholder/default links and must remain unavailable; safety-talk mail is deferred.

Use `local/migration-checks/email-recipient-audit.sql` for aggregate counts only.
It reads profiles/settings internally, but returns no employee rows, email values,
tokens or payloads. Counts identify fan-out and missing configuration; they cannot
confirm the intended owners of addresses. A private owner review of effective
settings remains necessary. Do not paste profile data into chat.

Worker controlled mode allows exact normalized address matches; it never redirects
messages. It still claims a batch before filtering, affecting visibility/read_ct
of unapproved queued messages. Consequently require an empty transactional queue
before the one-message proof; do not use the allowlist to justify draining a mixed
queue. Preserve existing messages and investigate if counts are nonzero.

## Exactly one fabricated notification

1. Obtain the owner's exact approved test inbox and explicit permission to send
   this one fabricated message there. A signed-in account or assumed owner address
   is not confirmation. No credential is needed from the user.
2. Complete backend grant/auth checks first. Confirm no active scheduler, delivery
   disabled, Postmark provider, approved sender/outbound stream, current suppression
   handling and successful local failure-path tests. Record baseline aggregate
   queue/log counts. Require transactional queue empty; preserve historical logs.
3. Configure EMAIL_DELIVERY_MODE=controlled and EMAIL_ALLOWED_RECIPIENTS to only the
   approved address privately. Keep delivery disabled. Check recipient not locally
   or provider-suppressed; do not delete suppressions to force the test through.
4. Invoke send-transactional-email once with service authorization, the approved
   recipientEmail, templateName=time-off-approved and fresh idempotencyKey
   migration-email-proof-<UUID>. Use only fabricated templateData:
   requesterName="TEST ONLY - migration proof <UUID>", type="Test notification",
   dateRange="No actual leave requested", reason="Synthetic delivery check; no action required",
   decidedBy="Migration test". This creates no time-off/business record.
5. Require successful queued:true response, exactly one queue row and one correlated
   pending log; privately compare its normalized recipient, label, synthetic marker
   and fresh timestamp. Record only booleans/counts and generated proof identifier.
   The API does not return message_id: coordinator must capture it internally from
   the unique marker/idempotency key without returning the full message payload.
6. Enable delivery temporarily in controlled mode; invoke the worker once with its
   configured service JWT. Require HTTP 200, processed=1 and failed=0. Immediately
   restore EMAIL_DELIVERY_ENABLED=false in a finally path even if verification fails.
   Never auto-retry an uncertain network/provider outcome: acceptance may already
   have happened, and the adapter does not promise exactly-once delivery.
7. Require matching sent log, no remaining proof queue row, and no new DLQ row.
   Check provider delivery evidence separately and ask owner to confirm inbox receipt
   and synthetic contents. Provider acceptance/sent log alone is not inbox proof.
   Leave logs as evidence; no blanket queue/log cleanup. Confirm inactive scheduler
   and disabled delivery after the test.

This proves the template/enqueue/worker/provider/inbox path only. Each required
business producer still needs controlled workflow acceptance. Test unsubscribe with
a synthetic local address first; clicking the owner's link suppresses that inbox
and is not a harmless read. Bounce/complaint webhook proof is separate and must not
create a real complaint or deliberate real-inbox bounce.

## Dispatcher preparation (not activation)

Candidate: `local/candidate-migrations/20261022010000_email_dispatcher_inactive.sql`.
Use one Supabase pg_cron job every minute, pg_net HTTP POST to the fixed destination
worker, and Vault credential lookup. This follows [Supabase scheduling guidance](https://supabase.com/docs/guides/functions/schedule-functions)
and [Cron controls](https://supabase.com/docs/guides/cron/quickstart). Current worker
requires a valid project service-role JWT matching EMAIL_WORKER_AUTH_TOKEN; the
public-key example in generic scheduling docs is insufficient for this worker.

The candidate requires reviewed cron/net/Vault extensions, postgres operator role
and explicit destination session marker. The marker is an operator guard, not
proof of server identity: runner must independently enforce the destination host.
It refuses to overwrite an existing job and commits the new job inactive. It
provisions neither extensions nor credentials and makes no HTTP request at install.
No schema changes are promoted into production migrations.

Local validation passed against the disposable Supabase database: candidate created
exactly one inactive job inside a transaction, then rolled back; missing destination
marker and duplicate-job attempts failed as expected; no dispatcher persisted. The
recipient audit returned one JSON result with all three aggregate sections. No worker
command was executed and no HTTP request was submitted. Before installation, verify
destination support/extension grants; absent-extension rejection remains untested. Before any bounded dispatch proof, the credential owner
privately stores the matching JWT as Vault secret schreiber_email_worker_auth_token;
never embed it in SQL files, shell arguments, cron command text or logs. Restrict
Vault/net/cron visibility to operators; net's pending HTTP requests contain auth
headers. Rotation must update both Vault and EMAIL_WORKER_AUTH_TOKEN coherently.

Verify only job name, cadence and active=false after install. Leave run history
empty until authorized testing; never import/delete source cron history. At later
approved scheduler proof, use one synthetic recipient and empty queue, activate for
one invocation only, then deactivate and restore delivery=false. Cron success means
HTTP was queued, not that mail was delivered: inspect pg_net response status,
worker result and mail outcome without exposing response bodies or auth headers.
Keep the first legitimate run records. No new monitoring database is needed.

Off switches: deactivate schreiber-email-dispatch with cron.alter_job; additionally
set EMAIL_DELIVERY_ENABLED=false. Neither recalls an already dispatched message.
Cadence is provisional pending a bounded duration test: current queue visibility is
30 seconds, so do not overlap manual/scheduled workers or consider runs exceeding
that lease safe without addressing concurrency. Provider uncertainty can duplicate
mail under existing retries; do not claim exactly-once processing.

Open gates: private business-recipient settings review,
controlled send/inbox evidence, producer acceptance, suppression webhook deployment
and proof, absent-extension rejection check, inactive installation and bounded dispatcher
auth test. A source review or passing mock tests does not close those hosted gates.
