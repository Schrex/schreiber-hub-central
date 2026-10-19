# Standalone Postmark adapter preparation

**Review status:** optional companion runtime work, not part of the audit-only PR.
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
