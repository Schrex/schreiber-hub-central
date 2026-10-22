# SMS transport preparation

> Historical migration record. For current production identity and operating rules,
> use [production baseline](production-baseline.md). Do not rerun migration steps
> or treat earlier pending-state descriptions as current status.

Prepared 2026-10-19. Safety-talk text messages remain in scope. The existing
Lovable/Twilio connector has been isolated behind a testable transport boundary;
no independent provider has been selected or configured and no SMS was sent.

## What changed

[`sms-transport.ts`](../supabase/functions/_shared/sms-transport.ts) accepts
server-side connector configuration and an injected fetch implementation. The
[`notify-talk-attendees`](../supabase/functions/notify-talk-attendees/index.ts)
handler supplies the same existing environment values and real fetch at runtime.
Its user/session authorization, in-app notification creation, message content,
recipient lookup and attendee updates remain unchanged.

The request still uses the Lovable Twilio gateway, the same authorization headers
and URL-encoded `To`, `From` and `Body` fields. Missing configuration does not call
the network. There is no automatic retry: an ambiguous response could represent
an accepted message, so blindly retrying may send duplicates.

Two response behaviors are intentionally stricter:

- Success requires a non-empty message SID; a malformed response must not mark an
  attendee's channel as `in_app+sms`.
- Failures return stable codes (`sms_http_<status>`, `sms_invalid_response`, or
  `sms_transport_error`). Raw vendor response text and exception messages are no
  longer persisted in `notify_channel`, where they could expose recipient/request
  details. Missing configuration retains `twilio_not_configured`.

An accepted SID proves only provider acceptance, not handset delivery. Delivery
receipts and duplicate-send policy remain future migration requirements. Existing
handler behavior can resend notifications on repeated invocation; the extraction
does not claim to solve endpoint idempotency or delivery tracking.

## Verification

[`smsTransport.test.ts`](../src/test/smsTransport.test.ts) uses fake fetch functions
and synthetic phone numbers/content only. Twelve tests pass, covering exact
endpoint/headers/form encoding, successful SID, each missing configuration value,
401/429/500 responses, malformed success data, invalid JSON and network exceptions.
They check no retry and prevent raw error text from leaking into returned reasons.
Focused ESLint for the transport, handler and tests passes without warnings.
These tests do not execute the hosted handler, access employee contacts or send SMS.
The parent preparation run records combined app and Edge verification.

## Remaining independent-provider work

1. Identify the company owner of the SMS account and sender number; establish
   whether the current number is company-owned and usable independently.
2. Choose the replacement transport and confirm its official API and applicable
   account/sender requirements before implementing an adapter. Existing connector
   credentials must not be assumed to be direct-provider credentials.
3. Keep secrets in server configuration only. Current runtime names remain
   `LOVABLE_API_KEY`, `LOVABLE_CONNECTOR_TWILIO_API_KEY`, and `TWILIO_FROM_NUMBER`;
   this change did not read, copy, rotate or set their values.
4. Configure an independent `APP_BASE_URL` before destination sends. The current
   handler still has a Lovable preview fallback; backend migration alone does not
   change the URLs in text messages. Test generated links with fabricated tokens.
5. Prove endpoint authorization and partial-failure behavior in synthetic staging,
   then use a company-approved test recipient only when live testing is explicitly
   authorized. Validate that in-app notifications still work if SMS fails.
6. Keep SMS and all outbound integrations inactive during real-data restore.
   Preserve existing notification/attendee state and source history; provider
   acceptance or this unit test suite is not independent restore proof.

No paid services, deployments, hosted setting changes or production actions were
performed. No capability was removed from launch scope.
