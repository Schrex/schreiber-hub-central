# Migration launch scope and readiness

Prepared 2026-10-19 on `codex/migration-audit-live-findings`. This document turns the
[integration map](migration-integration-map.md) into an implementation sequence.
It records options, not approval to drop features or release production. No
providers, settings, credentials, deployed functions or source records were changed.

## Preserve the existing app capabilities

The plan is to keep the features people already use: signing in with Google,
generating safety talks and extracting information from documents with AI, sending
safety-talk text messages, reading talks aloud, and turning recordings into text.
Password login and application emails remain part of the same preservation baseline.
**All of these features stay in scope. No feature removal or deferral is authorized.**
The user does not need to make a feature choice for preparation to continue.

Moving hosting does not automatically replace the services behind those features.
We can prepare the code and synthetic tests now; company account owners, provider
access and any spending decisions still need to be established. This plan authorizes
neither paid infrastructure nor provider usage. The deferral column below is only a
contingency if the user explicitly requests a scope change later.

| Capability | Readiness and dependencies | Work to preserve it at launch | Only if later explicitly deferred | Owner/access decision |
| --- | --- | --- | --- | --- |
| Existing-user password login and account/role continuity | Required preservation baseline; private database export and copied-user login are unproved. Source Auth mail configuration is incomplete. | Restore compatible users/hashes/identities and application relationships, configure redirects and policy, privately prove a permitted copied-account login. Synthetic signup/reset/admin-create tests remain separate. | Cannot silently drop account continuity. Any alternate account recovery approach needs a specific user decision and migration plan. | Destination Auth admin; full export; authorized login tester and secure credential handling. |
| Auth and transactional email | Core workflow readiness unproved. Lovable email worker processes Auth and transactional queues; actual Auth enqueue hook is still unknown. | Select independent transport, configure verified sender and Auth delivery, preserve suppression/unsubscribe and send state, prove synthetic deliveries/retries. Test each used template class. | Requires explicit acceptance of every affected workflow and a defined alternative; disabling transport alone can strand confirmations/resets and queued business messages. | Company mail account and DNS owner; provider choice; actual Auth hook/SMTP configuration. |
| Google sign-in | **In scope; readiness unproved.** Lovable broker in `src/integrations/lovable/index.ts`; destination client/origins and continuity not proved. | Replace with independent OAuth implementation; configure company Google client; synthetic login and redirect test, followed by private continuity assessment. | Show the method as unavailable or remove its entry point consistently; ensure password login works for the affected users. Do not assume all users know a password merely because source identities were recorded as email. | Company Google Cloud owner, OAuth client and approved origins. |
| AI generation/extraction | **In scope; readiness unproved.** Five functions use Lovable AI; toolbox generation includes text and image. | Choose independent provider/model contract; adapt five functions and image response handling; test authorization, malformed responses, timeouts and fabricated inputs. | Disable each generation/extraction action clearly while preserving existing generated talks, briefs, scopes, images and documents. Verify manual workflows remain usable; no silent blank results. | Provider/account owner, model/data-handling choice and usage budget. |
| Safety-talk SMS | **In scope; readiness unproved.** `notify-talk-attendees` depends on Lovable Twilio connector and a preview default URL. | Adapt transport to owned SMS account/number, set app base URL, test authorized delivery via stub then approved test number; verify error/retry behavior. | Disable the SMS path visibly while preserving any in-app notification behavior; check caller messaging does not claim successful SMS. Existing records must remain. | SMS account/number owner, permitted test recipient and sender configuration. |
| Speech playback (TTS) | **In scope; readiness unproved.** Deepgram primary, ElevenLabs fallback in `speak-toolbox-talk`. | Retain direct integrations with independent keys and supported voice/output settings; test fallback, error display and fabricated text. | Disable playback action with clear status; retain readable talk text and existing media. Do not equate STT readiness with TTS readiness. | Provider account owner and permitted usage. |
| Speech transcription (STT) | **In scope; readiness unproved.** Direct ElevenLabs integration in `transcribe-toolbox-talk`. | Configure independent key; test fabricated recording, authorization, transcript result and provider failure. | Disable transcription entry points and establish the intended manual text workflow; preserve stored recordings/transcripts. | Provider account owner and permitted usage. |

The full [integration matrix](migration-integration-map.md#replacement-and-verification-matrix)
also covers inbound SWPPP, schedules, Realtime, frontend hosting and external
services. They remain migration gates alongside the capabilities above.
Do not assume email approval also covers SMS, AI, speech or inbound routing.

## Implementation sequence

1. **Proceed with the preservation baseline.** Keep Google, AI, SMS, speech playback
   and transcription in scope alongside core Auth/email. Identify the company owners
   and account access needed for each. Inventory required email and inbound workflows;
   unresolved access does not authorize dropping a feature.
2. **Prepare contracts and synthetic tests.** On a feature branch targeting
   `develop`, isolate provider transports from business logic. Capture authorization,
   request/response and failure behavior with stubs, fake recipients, fabricated
   documents and synthetic recordings. Preserve queue, suppression and audit semantics.
3. **Implement core Auth/mail first.** Replace the required broker/transport paths,
   configure destination redirects and provider webhooks in a synthetic
   environment, and prove confirmation/reset/delivery behavior. Source email continues
   unchanged. Capture actual deployed source parity before trusting repo assumptions.
4. **Prepare the other existing features in parallel.** Google, AI and speech
   adapters can be separate changes. SMS work must account for shared in-app notification
   behavior. Provision credentials only through a private channel when owner access is
   available; no production keys or service-role credentials in browser settings.
5. **Verify complete feature coverage.** Check that every existing entry point has
   a working independent service path and useful error handling. No deferral is approved.
   If the user later explicitly changes scope, gate both UI and server behavior, preserve
   existing data, and test the agreed alternative; hiding a button alone is insufficient.
6. **Run relevant verification.** Use pinned Bun and the repo's app/backend/lint/edge/
   browser groups as appropriate to the implementation. Passing stub/local tests does
   not establish provider delivery, production parity or copied-user continuity.
7. **Complete real-data rehearsal when export access returns.** Lock down the
   destination before import, disable all outbound execution, restore and validate
   independently. Preserve business/Auth/files/delivery state; destination scheduler
   execution history alone starts empty, source history stays untouched.
8. **Request separate production release authorization after readiness evidence.**
   Include restore results, retained-feature tests, accepted deferrals, access owners,
   final-copy procedure and rollback criteria. No merge into `main`, DNS switch or
   Lovable cancellation is part of this preparation.

## Evidence required before a feature is called ready

For each capability, record the reviewed code change, synthetic environment,
test date/result, failure-path result, owner of the independent account, and unresolved
differences. Provider delivery tests require an approved controlled endpoint/recipient.
Store evidence without private payloads, tokens, hashes or employee contact details.

If the user later explicitly defers a capability, record the user's decision, the visible disabled
behavior, the tested alternative and a later enablement dependency. A deferral is
accepted scope, not a passed integration test. No capability is marked ready by this
document; no implementation or provider test has been executed for this workstream.

## Checks performed

Rechecked the feature branch, integration map, current Auth Google entry point and
SMS function's connector/configuration path. Earlier integration-map inspection
covered the linked AI/speech/mail sources. Verified local document link targets and
whitespace. This documentation-only work did not run application tests or access
provider accounts, production data, secrets or the private export.
