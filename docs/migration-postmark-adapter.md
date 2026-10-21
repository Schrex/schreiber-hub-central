# Postmark adapter and activation status

## Current implementation — 2026-10-20

The adapter and its 34 synthetic tests have now been brought onto the restore
branch and connected to process-email-queue. Earlier standalone-only statements
below describe the preparation phase. The eight reviewed functions are now deployed
on the destination with delivery disabled. The worker passes missing/invalid/anonymous
credential denial and an authorized delivery_disabled response; queue privileges,
ordinary-user acceptance, suppression handling and actual delivery remain pending.

Destination-only configuration required before deployment:

- EMAIL_PROVIDER=postmark (unset preserves the existing Lovable path).
- POSTMARK_SERVER_TOKEN entered privately as a server secret; not an SMTP password.
- POSTMARK_MESSAGE_STREAM=outbound and POSTMARK_FROM=no-reply@mail.schrex.com.
- EMAIL_DELIVERY_ENABLED remains unset/false until queue state, recipient selection,
  suppression/unsubscribe and a controlled delivery are ready. Disabled mode does
  not claim messages or write send logs. No schedule is enabled by this code.

Local reliability follow-up (not deployed): worker authorization now compares the
actual configured service key rather than trusting decoded JWT claims. Database
operation errors produce non-success responses. Unsubscribe first writes idempotent
suppression, then consumes the token; retry can repair earlier partial failures.
This is retry-safe ordering, not a database transaction.

Hosted worker compatibility: set EMAIL_WORKER_AUTH_TOKEN privately to the destination
service-role JWT used by the dispatcher. This exact expected caller credential is
separate from the platform-injected SUPABASE_SERVICE_ROLE_KEY used for database
calls; it replaces that key's authentication fallback when configured. Keep
verify_jwt=true. Rotate this setting with the dispatcher's project service-role
credential. It is not the Postmark API token. No credential belongs in VITE_ config.

Delivery defaults to EMAIL_DELIVERY_MODE=controlled. EMAIL_ALLOWED_RECIPIENTS must
list exact approved mailboxes before enabling a controlled send. Other queued
recipients are not sent, deleted, redirected or moved to DLQ; a batch claim still
temporarily changes visibility/read count. Only explicit production mode allows
unrestricted recipient processing, and activation requires release approval.
These settings do not replace reviewing restored recipient overrides/fan-out.

Postmark mode processes only transactional_emails; Auth uses separate Supabase SMTP.
The worker overrides archived sender addresses with POSTMARK_FROM and derives the
unsubscribe handler from the destination SUPABASE_URL. Local suppression is checked
again at send time. Permanent rejects/suppressed recipients enter the existing DLQ;
configuration errors stop processing without discarding queued messages; rate limits
retain the existing cooldown handling. Uncertain acceptance follows the existing
bounded retry policy and can duplicate delivery. No new tracking infrastructure.
Provider acceptance remains logged as sent, not proof of inbox delivery.

Remaining activation work: destination queue/RPC inventory, private server token,
review of old queued messages (do not replay them), independently authenticated
Postmark suppression webhook, worker integration acceptance and controlled send.
Do not use the existing Lovable webhook verifier for Postmark events.
Static Edge checks now include the worker. App verification (53 tests/typecheck/
build), lint (0 errors/30 existing warnings) and all 16 Edge entry checks pass.
These checks do not prove hosted delivery or queue integration.

Auth SMTP was saved privately by the user and the rehearsal email hook disabled
after explicit approval. Inbox delivery was confirmed; the user reported successful
code recovery/password update/sign-in. Signup remains disabled. The independent
production host and app notification delivery remain unverified.


## Historical adapter preparation (superseded integration constraints)

The remainder records the original standalone design. Statements that the worker
is unchanged, requires a new durable coordinator, or cannot consume this adapter
are superseded by the current implementation above and migration-completion-plan.md.
The accepted scope retains bounded retries and their documented duplicate risk;
additional delivery-tracking infrastructure remains paused.

**Original review status:** optional companion runtime work, not part of the audit-only PR.
Further delivery-tracking infrastructure is paused. Current plan: Supabase Auth
SMTP and the existing notification queue; this module is not an activation gate
for DNS verification or Auth SMTP testing.

Prepared 2026-10-19. The worker still selects Lovable, unchanged. No Postmark token
was read, no API was called, and nothing was deployed. The new module is imported
only by synthetic tests; it requires an explicitly injected HTTP client.

## Implemented mapping

The standalone adapter in `_shared/postmark-email.ts` sends one request to the
fixed HTTPS `/email` endpoint, with a server token header and explicit message
stream. It maps from/to/subject, HTML/text, label to Tag, and application message
ID to metadata. Tracking is disabled explicitly. A successful response must contain
ErrorCode zero and a provider MessageID, which is returned for future persistence.
This follows the [Postmark Email API](https://postmarkapp.com/developer/api/email-api).

An unsubscribe token requires an explicit reviewed HTTPS handler endpoint. The
adapter constructs `List-Unsubscribe` and `List-Unsubscribe-Post` headers and URL
encodes the token. No token means no unsubscribe headers. The caller must decide
Auth versus transactional/broadcast handling; this module does not infer stream
or unsubscribe policy from Lovable's purpose field. Custom unsubscribe behavior
and provider-added headers must be confirmed for the actual stream before enabling.

## Explicit delivery outcomes

The adapter now exposes `deliver(): Promise<PostmarkDeliveryOutcome>`, deliberately
not the worker's `send(): Promise<void>` interface. A future consumer must persist
and handle the result explicitly. The live worker remains unchanged and does not
import this module. There is no automatic retry in the adapter.

| Outcome | Policy |
| --- | --- |
| `accepted` | HTTP 200, ErrorCode zero and a non-empty MessageID; persist the returned receipt. Acceptance is not delivery. |
| `suppressed` | HTTP 422 with code 406; stop this attempt and reconcile suppression state. |
| `permanent_rejection` | Known input/payload rejection; stop unchanged resends and review the message. |
| `configuration_error` | Local invalid configuration or authentication/server/stream/account rejection; stop and repair configuration. |
| `rate_limited` | Uncontradicted HTTP 429; defer using a positive integer Retry-After or 60-second default. The adapter does not resend. |
| `ambiguous` | Timeout/network failure, invalid success, contradictory receipt/status, unrecognized response or server failure; hold for reconciliation, with no retry delay or synthetic 503. |

HTTP statuses and provider codes remain distinct. Code 403 means invalid fields;
code 406 means inactive recipient. Postmark describes HTTP 500 loss as occurring
in most cases, which is not a no-send guarantee. We conservatively hold all 5xx
results, including maintenance responses, rather than infer non-acceptance.
This is our conservative policy, informed by the
[official error reference](https://postmarkapp.com/developer/api/overview).
No raw provider text, recipients or network-error details enter the outcome.

Unknown response shapes are held; they are not silently classified as retryable.
Known 422 validation codes are enumerated in code. Any future additions require
review against the provider reference. A MessageID on a rejection is contradictory
and therefore held, not automatically resent or treated as accepted.

## Activation gates and limits

- No idempotency feature is assumed. Application IDs in metadata are correlation,
  not deduplication. A timeout can mean delivery succeeded; this adapter does not
  retry. The incompatible outcome interface prevents direct use as the current worker's
  send transport, but a careless wrapper could still ignore outcomes. Resolve reconciliation and
  persist provider MessageID before connecting the adapter to the worker.
- The current worker cannot consume these outcomes. A separate reviewed coordinator
  must durably hold ambiguous attempts, persist receipts, apply suppression/config
  decisions and defer rate limits. Do not discard the outcome or convert an ambiguous
  result to a generic delivery exception. A crash after acceptance but before receipt
  persistence is still ambiguous; no exactly-once guarantee is made.
- Preserve application suppression lists and prevent queued mail delivery after
  unsubscribe. Postmark suppression webhooks are not the Lovable signature format.
  Existing non-atomic unsubscribe writes remain a separate blocker.
- Account approval, sender/domain verification, stream ownership/configuration,
  DKIM/return path, and secure destination server token provisioning remain gates.
- Sender-domain, run ID and purpose from Lovable are not blindly transmitted.
  The adapter intentionally covers only the explicit message interface. No
  attachments, batch requests, SMTP/Auth hooks, templates or webhook routing.
- Request timeout is fifteen seconds; redirect following is disabled. HTTP-date
  Retry-After and malformed values use the default, rather than guessing delays.
  This is not a complete provider-limit or hostile-input validator.

Thirty-four mocked tests cover payload mapping, unsubscribe configuration, stream
requirements, accepted receipt, API-vs-HTTP distinctions, permanent/config/suppression
results, rate-delay validation, conflicting responses, malformed success, 5xx,
unknown codes and ambiguous network failure. Every request
uses a test fake; no `POSTMARK_API_TEST` network request was made either.

```sh
bun run test src/test/postmarkEmail.test.ts
```

Webhook compatibility is explicit: Postmark does not provide Lovable-style HMAC
signatures. Its documentation recommends HTTP Basic Authentication with IP
allowlisting; the Webhooks API also supports custom headers. A future receiving
handler needs distinct authentication, validated event shapes, and replay/event
identity handling, rather than passing events to `verifyWebhookRequest` with a
Lovable key. See [webhook security](https://postmarkapp.com/developer/webhooks/webhooks-overview)
and [webhook configuration](https://postmarkapp.com/developer/api/webhooks-api).

Current focused outcome tests pass (34 tests). The parent preparation run records
combined verification. No provider traffic or credentials were used.
