# Integration preparation for the independent copy

Prepared 2026-10-19 from the current `codex/migration-audit-live-findings` checkout,
the [migration audit](migration-audit.md), and the current progress record. This is
a repository-backed dependency map and test plan, not evidence that replacement
providers work. No credentials were read, integrations called, settings changed,
or services provisioned for this map.

The database download is paused. The user-selected local archive is
`/Users/sumanththota/Schrex/archive`; the restricted hosted rehearsal destination is
`hub-rehearsal` (`acgqjjbrnkmeazswdnzp`). The real-data rehearsal must remain separate
from synthetic development/staging. Signup may remain enabled for synthetic tests
while the destination is empty; disable it before loading real data. That user
decision supersedes the older audit's blanket instruction to disable staging signup.

## Replacement and verification matrix

All tests below are **planned, not executed**. Use synthetic records, fabricated
documents/audio and a mail/SMS sink. Do not use copied employee contact details,
attachments, or exported Auth credentials for integration smoke tests.

| Integration and repository evidence | Destination work | Synthetic acceptance check | Missing owner or access |
| --- | --- | --- | --- |
| Password Auth and account creation: [`Auth.tsx`](../src/pages/Auth.tsx), [`create-employee`](../supabase/functions/create-employee/index.ts), [`convert-employee-contact`](../supabase/functions/convert-employee-contact/index.ts). New-user database trigger also creates application profile/role/contact state. | Preserve Auth identities and password hashes through the private restore. Inventory site URL, redirects, confirmation/password/MFA policy, templates and the actual mail hook. Preserve profile/role trigger behavior; avoid replaying historical employee seed accounts. | In synthetic staging, signup/confirmation, password login/reset, admin-created account and role assignment. Anonymous and ordinary employee callers must fail admin account creation. Copied-user continuity is a later private rehearsal gate. | Destination project administrator; complete Auth settings/export; an authorized copied-account test operator. A database dump alone does not prove hosted Auth settings were copied. |
| Google Auth: [`lovable/index.ts`](../src/integrations/lovable/index.ts) uses `@lovable.dev/cloud-auth-js`; [`Auth.tsx`](../src/pages/Auth.tsx) requests Google. | Replace the broker with independent Supabase OAuth flow; company-controlled Google client and matching callback/origins. `VITE_LOCAL_BACKEND=true` intentionally disables Google in the current local UI. | Dedicated synthetic Google test identity signs in on staging, returns to the allowed origin and receives the intended role. Validate identity continuity privately later; no assumption that relinking is required. | Company Google Cloud/OAuth owner and destination Auth admin; staging origin. Prior source aggregate showed email identities only, which does not prove brokered login continuity. |
| Transactional mail: [`send-transactional-email`](../supabase/functions/send-transactional-email/index.ts), [`process-email-queue`](../supabase/functions/process-email-queue/index.ts), [templates](../supabase/functions/_shared/transactional-email-templates). Worker calls Lovable email SDK. It processes both `auth_emails` and `transactional_emails`. | Replace the transport while retaining queue contracts, retry/dead-letter behavior, deduplication, send log and suppression checks. Inventory the Auth enqueue/hook separately; it is not proven by the presence of an Auth queue. Verify company sender domain and DNS before real delivery. | Sink captures signup/reset and one message per template class; transient failure/retry, duplicate handling and expired message behavior tested with fake recipients. Confirm links point to staging. | Mail provider account owner, DNS owner for `schrex.com`/sender subdomain, destination Auth hook/SMTP configuration and provider credentials through a private channel. No provider has been selected or paid plan authorized. |
| Mail suppression/unsubscribe: [`handle-email-suppression`](../supabase/functions/handle-email-suppression/index.ts), [`handle-email-unsubscribe`](../supabase/functions/handle-email-unsubscribe/index.ts). Suppression verification uses Lovable webhook SDK; unsubscribe uses stored tokens. | Adapt signature verification and event mapping to the replacement provider. Preserve `suppressed_emails`, unsubscribe tokens and delivery logs; do not classify them as disposable scheduler history. Keep tokenized URLs out of logs. | Synthetic unsubscribe GET/one-click POST suppresses later delivery; invalid token/signature rejected; fake bounce/complaint is recorded once. | Provider webhook admin, event signing credentials and public endpoint ownership. Source provider configuration is unverified. |
| AI: [`generate-toolbox-talk`](../supabase/functions/generate-toolbox-talk/index.ts), [`suggest-safety-topic`](../supabase/functions/suggest-safety-topic/index.ts), [`extract-foreman-brief`](../supabase/functions/extract-foreman-brief/index.ts), [`extract-scope-from-contract`](../supabase/functions/extract-scope-from-contract/index.ts), [`categorize-document`](../supabase/functions/categorize-document/index.ts). Five functions call Lovable AI; generation also requests an image. | Select a company-controlled provider or deliberately disable the feature. Adapt endpoint, authorization, model names and response parsing, including image responses and file inputs. Moving email domains does not migrate AI. | Stub responses first: valid/invalid JSON, unavailable provider, unauthorized caller, text/image result handling. Only later use fabricated contract/document input against an approved provider. | Provider account owner, permitted models/data handling, usage budget and server-side credentials. No paid inference call authorized by this document. |
| SMS: [`notify-talk-attendees`](../supabase/functions/notify-talk-attendees/index.ts) uses Lovable Twilio connector and has a Lovable preview default for `APP_BASE_URL`. | Replace connector with company-controlled SMS transport or disable SMS visibly. Set destination `APP_BASE_URL`; preserve notification semantics. Inventory sender-number ownership before choosing number migration. | Stub transport with fake numbers; verify safety links point to staging, missing config fails clearly, unauthorized caller rejected, and retries do not cause uncontrolled duplicate sends. | SMS/Twilio administrator, sender-number ownership and provider credentials. Existing connector runtime configuration is not proven by the visible custom-secrets list. |
| Speech: [`speak-toolbox-talk`](../supabase/functions/speak-toolbox-talk/index.ts), [`transcribe-toolbox-talk`](../supabase/functions/transcribe-toolbox-talk/index.ts). Direct Deepgram TTS with ElevenLabs fallback; ElevenLabs STT. | Provision independent server-side keys only if feature retained; verify voices/formats, fallback and error handling. These APIs do not use Lovable's email domain or AI gateway. | Fabricated text/audio, authorization rejection, provider timeout, TTS fallback and STT result/error. Use stubs before an approved provider call. | Deepgram/ElevenLabs account owner, key issuance and permitted usage. Existing key portability and plan behavior remain unverified. |
| Inbound SWPPP: [`inbound-swpppp-email`](../supabase/functions/inbound-swpppp-email/index.ts) supports multiple provider payload shapes, extracts job number and stores an attachment. | Identify actual provider, mailbox/forwarding rules, webhook URL, gateway JWT setting and secret. Recreate against synthetic staging first; do not reroute source mail. Handler requires `SWPPPP_INBOUND_SECRET` despite an obsolete nearby comment calling it optional. Prefer the supported `x-webhook-secret` header over URL credentials when provider permits. | Fake job and PDF; supported payload parses, wrong/missing secret rejected, unknown job handled, file stored at expected path. Measure repeated delivery behavior rather than assuming idempotence. | Inbound mailbox/provider administrator, forwarding/DNS owner and securely issued shared secret. Source gateway configuration is not represented explicitly in `config.toml`. |
| Schedules and queue wake: [`daily-celebrations`](../supabase/functions/daily-celebrations/index.ts) plus historical live catalog evidence in [audit §5](migration-audit.md#5-schedules). Dispatch/wake SQL and triggers are not fully in git. | Export exact job definitions, queue triggers, dispatch/wake functions, Vault references and cooldown state. Adapt endpoints and destination credentials; keep copied jobs and enqueue/wake execution inactive before restoring rows. Inventory external schedulers too. | On synthetic staging only, controlled manual execution sends to sink once; non-empty queue wakes worker, empty queue becomes idle, cooldown/retry and duplicate prevention checked. Destination `cron.job_run_details` starts empty. | Full private schema/config export, destination database operator and owner of any external scheduler. Preserve source history and business/delivery state. Simply unscheduling cron does not prevent queue triggers re-arming it. |
| Realtime: client subscriptions and [audit §7](migration-audit.md#7-realtime). Historical source publication contains notifications, truck requests and whiteboard tiles. | Preserve publication and authorization baseline, then test independently. Attendee-table publication was absent in source; adding it is a separate behavior change. | Two synthetic identities: intended update arrives, unauthorized identity cannot receive protected data, reconnect works. Local stack has Realtime disabled and cannot provide this proof. | Hosted staging access and complete publication/grant export. |
| Frontend host and ordinary external services: [`weather.ts`](../src/lib/weather.ts), [`LocationPicker.tsx`](../src/components/jobs/LocationPicker.tsx), [`DriveTimeFromShop.tsx`](../src/components/jobs/DriveTimeFromShop.tsx), [`Index.tsx`](../src/pages/Index.tsx), [`DigTicketsSection.tsx`](../src/components/jobs/DigTicketsSection.tsx). | Independent static host with SPA fallback and destination browser configuration; inventory DNS control. Weather/geocoding/routing/maps make external requests; HCSS/Clearstory/Divvy/Exactix are links rather than Lovable replacement transports. Avoid real job locations in synthetic tests. | Synthetic location/weather/routing and link checks, deep-route refresh, private upload host, public-image host and auth redirects. Test service errors without claiming external uptime. | Company DNS/hosting owner, staging hostname; existing external product account owners if link access needs validation. Hosting selection/deployment and DNS switch remain separate decisions. |

## Credential handoff checklist (names and roles only)

- Destination Supabase platform credentials: backend URL, server-only service-role
  credential, secure database connection. Browser receives publishable credentials
  only. Do not reuse the source service-role key or its Vault copy.
- Auth: company Google client ID/secret; actual SMTP or send-email-hook credentials
  after choosing the delivery design.
- Existing code names to retire or replace: `LOVABLE_API_KEY`, `LOVABLE_SEND_URL`,
  `LOVABLE_CONNECTOR_TWILIO_API_KEY`. A new value alone does not remove SDK/gateway
  dependencies. Provider-specific new names should follow the reviewed implementation.
- Existing independent names to configure if retained: `DEEPGRAM_API_KEY`,
  `ELEVENLABS_API_KEY`, `TWILIO_FROM_NUMBER`, `APP_BASE_URL`,
  `DAILY_CELEBRATIONS_SECRET`, `SWPPPP_INBOUND_SECRET`.
- Review private exported function/job definitions for embedded credentials;
  schema-only output and cron commands are not automatically safe to commit.

## Work that can proceed while the export is unavailable

1. Assign the company owners listed above and select which optional AI/SMS/speech
   features must be present at cutover. Do not silently treat disabled features as passed.
2. Prepare transport adapters and stub tests on a feature branch targeting `develop`.
   Keep the source Lovable app and production configuration intact.
3. Capture destination settings read-only and plan the isolation changes needed
   before real data arrives. Public signup testing stays synthetic.
4. Once the export is available, compare deployed sources/settings to this map;
   repository evidence cannot establish deployed parity or reveal missing external jobs.

## Verification performed for this document

Read `AGENTS.md`, current progress, local development guidance and migration audit;
checked the current feature branch before editing. Rechecked the referenced source
files for provider imports/endpoints, secret names, Auth wrapper, inbound mandatory
secret check, configured JWT settings and ordinary external URL call sites.
Documentation links and whitespace were checked. No application code changed, so
application/backend/edge/browser tests were not rerun for this map. Integration
tests, provider account ownership, deployed parity and actual restore remain pending.
