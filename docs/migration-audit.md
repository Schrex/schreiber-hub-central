# Migration audit — Schreiber field app off Lovable

Read-only audit of GitHub `main` at `5a81add` ("Lovable update"), compared with `origin/develop` at `936bef8`. No production database, storage, or Lovable project was contacted. No secrets are recorded here.

**Live app (from README):** https://schreiber-hub-central.lovable.app  
**Lovable project id (from README):** `be4f9bee-f0ea-4d93-8142-1b82027df08c`  
**Supabase project ref:** `bitogpfplcquovpdjprk` — verified in `supabase/config.toml` and in the tracked `.env` URL/project id. The host is `*.supabase.co`.

`main` is what Lovable two-way syncs. `develop` is 21 commits ahead and 0 behind; it was never merged (PR #9, "Develop", is closed). Do not merge this audit, or `develop`, into `main`.

## Where the notes live

| Document | On GitHub `main` | On GitHub `develop` | `codex/local-development-foundation` |
| --- | --- | --- | --- |
| `AGENTS.md` | Absent | Present | Not a current branch |
| `DEVELOPMENT_PROGRESS.md` | Absent | Present | Not a current branch |
| `local/README.md` | Absent | Present | Not a current branch |

Remote branches today are only `main` and `develop`. The foundation work was merged into `develop` by PR #7 (`codex/verification-cleanup`, includes `9ce17fd` "checkpoint isolated local development foundation"). PR #8 (`codex/time-off-browser-test`) is also merged. `DEVELOPMENT_PROGRESS.md` is stale on both points: it still says the foundation lives on `codex/local-development-foundation` and that PR #8 is unmerged.

Also on `develop` only, and used below as evidence that was checked against `main` code: `local/AUDIT.md`, `local/SCHEMA_RECONCILIATION.md`, `local/SCHEMA_REQUEST.md`, `local/hr-bootstrap.sql`, `local/reference/schema_benefits_positions_timeoff.sql`, `local/candidate-migrations/20261016210000_time_off_request_permissions.sql`. `supabase/migrations` is identical on `main` and `develop`.

Those notes are partly right and partly outdated:

- Right: three HR tables exist in the live catalog and in generated types, and are missing as `CREATE TABLE` from migrations. A 2026-10-16 catalog export (Postgres 17.6) was used to reconstruct them locally. Local checks were synthetic and are not production parity.
- Stale: the reconciliation doc says the time-off permission fix is `supabase/migrations/20261016210000_...sql`. It is not. It sits only in `local/candidate-migrations/` on `develop` and is not applied anywhere in this repo's migration history.
- Not re-run for this audit: Docker local backend, the "60/60 tables" inventory command, or browser tests. The table-name gap itself is confirmed by reading migrations and `src/integrations/supabase/types.ts`.

## Inventory

Classification: **VERIFIED** means the claim is in the code on `main`. **NEEDS ACCESS OR EXPORT** means the repo cannot prove the live value. **BLOCKER** means cutover cannot be done safely until that item is resolved.

| # | Area | Classification | What the code shows |
| --- | --- | --- | --- |
| 1 | Database / schema | **VERIFIED** drift, **BLOCKER** for a clean replay | 78 SQL files. Generated types list 60 `public` tables. Migrations create 57 that still exist (`activity_equipment` is created then dropped). Missing `CREATE TABLE`: `benefit_types`, `employee_benefits`, `employee_compensation_history`. Later migrations still attach audit and validation triggers to the last two, so a fresh replay of `supabase/migrations` fails. `email_queue_dispatch` is in `types.ts` and in no SQL file. Enums in types match `CREATE TYPE` in migrations (26). View `positions_public` is in both. View `employee_contacts_directory` is in SQL only; the client uses `list_employee_directory()`. Dynamic `DO` blocks do create RLS policies for bid and job-scope tables. |
| 2 | Auth | **VERIFIED** split, **BLOCKER** to leave Lovable | Email/password uses `supabase.auth.signInWithPassword` / `signUp` in `src/pages/Auth.tsx`. Google uses `src/integrations/lovable/index.ts` (`@lovable.dev/cloud-auth-js`), then `supabase.auth.setSession`. Redirect is `window.location.origin`. Public signup is in the UI. `handle_new_user` (final version in `20260425202240`) inserts `profiles`, default `user_roles` role `employee`, and links or creates `employee_contacts`. Migration `20260419193344` inserts four named auth users with one shared password in the SQL file. |
| 3 | Storage | **VERIFIED** bucket list, **NEEDS ACCESS** for bytes | 15 buckets in migrations. Only `talk-media` is public. The rest are private and mostly use signed URLs. Object counts and total bytes are not in git. |
| 4 | Edge Functions | **VERIFIED** source, **NEEDS ACCESS** for deployed config and secrets | 23 functions under `supabase/functions`. Several call `https://ai.gateway.lovable.dev`. Email send uses `npm:@lovable.dev/email-js`. |
| 5 | Scheduled jobs | **NEEDS ACCESS OR EXPORT**, partial **VERIFIED** | Migrations enable `pg_cron`, `pg_net`, `pgmq`, and `supabase_vault`, and create queues `auth_emails` and `transactional_emails` plus DLQs. The `process-email-queue` cron (commented as every 5 seconds, via `net.http_post` and vault secret `email_queue_service_role_key`) is applied outside SQL by Lovable `setup_email_infra`. `daily-celebrations` has no schedule in the repo. |
| 6 | Email | **VERIFIED** Lovable path, **BLOCKER** for an independent sender | No Resend. Transactional mail is queued and sent through Lovable. From address is `Schreiber Hub <noreply@notify.www.schrex.com>`. Comments say that subdomain must be delegated to Lovable nameservers. Unsubscribe is `handle-email-unsubscribe`. Suppression webhook expects Mailgun events via `@lovable.dev/webhooks-js`. Inbound SWPPP is `inbound-swpppp-email`. Auth email templates are not in the repo. |
| 7 | Realtime | **VERIFIED** subscribers; publication list incomplete in SQL | Client listens to `truck_requests`, `notifications`, `whiteboard_tiles`, and `toolbox_talk_attendees`. Migrations add only the first three to `supabase_realtime`. `notifications` is `REPLICA IDENTITY FULL`. `20260513013337` locks down `realtime.messages` (broadcast/presence). `develop` notes that this statement fails on a local CLI database. |
| 8 | Secrets | **VERIFIED** names only | See the name list below. Values were not copied. The tracked `.env` has three `VITE_` client settings and no service-role key. |
| 9 | Lovable-specific code | **VERIFIED** | Packages, `.lovable/`, auth wrapper, AI gateway, email/Twilio connectors, preview-auth storage, hardcoded `*.lovable.app` URL. |
| 10 | Hosting | **VERIFIED** build shape; domain is **NEEDS ACCESS** | Vite SPA, `BrowserRouter`, no `vercel.json` / Netlify / Cloudflare config. `npm run build` → `dist/`. Env is inlined at build time. README live URL is the Lovable host. No custom app domain is in the repo. |

### 1. Schema, RLS, and pay / HR data

`src/integrations/supabase/types.ts` reports PostgREST `14.5`. The `develop` catalog note says Postgres 17.6. Both are consistent with current Supabase; neither was rechecked against the live server.

**In types and not created by migrations**

| Object | Why it matters |
| --- | --- |
| `benefit_types` | Lookup for benefits. Columns in types: `name`, `description`, `default_annual_value`, `is_active`, `sort_order`, timestamps. |
| `employee_benefits` | Per-user benefit amounts (`annual_value`, `effective_date`, `end_date`, `benefit_type_id`). Triggers in `20260421010923` and `20260421020148` target this table. |
| `employee_compensation_history` | `base_salary`, `bonus`, `benefits_value`, generated `total_compensation`, `year`. Same trigger files. |
| `email_queue_dispatch()` | Zero-arg function in types only. Likely the live cron entrypoint. Body unknown. |

`develop`'s `local/hr-bootstrap.sql` reconstructs the three tables from the 2026-10-16 export, including RLS, and normalizes `total_compensation` to `GENERATED ALWAYS AS ((base_salary + bonus) + benefits_value) STORED`. That file is explicitly local-only. The export's grants only mention `sandbox_exec`, so anon/authenticated/service_role grants are still unproven. Do not run the bootstrap against production: those tables already exist there.

**Pay and HR storage (VERIFIED in migrations plus types)**

| Data | Where | Access in SQL |
| --- | --- | --- |
| Pay rates and salaried flag | `employee_positions` | RLS: employee reads own rows; admin writes. Audit trigger → `pay_audit_log`. |
| Pay bands | `positions.min_pay_rate`, `max_pay_rate` | Admin select policy. `positions_public` omits pay bands (`security_invoker`). |
| Comp history and benefits | tables above | Policies exist in the local reconstruction, not in `supabase/migrations`. |
| Audit | `pay_audit_log` | Admin `SELECT` only. No client write policies. |
| SSN, bank, license number, emergency contact, termination | `employee_contacts` | Column `SELECT` revoked from `anon` and `authenticated` (`20260513012349`). `get_employee_contact_sensitive` is security definer and office/admin only. |
| Referral fees | `referrals.fee_amount`, `paid_at` | Column select revoked from client roles. |

`SECURITY.md` (dated 2026-04-21) matches this design. It also claims HIBP leaked-password rejection, required email confirmation, and admin MFA. None of those are in the repo. They are dashboard settings.

The current HR page marks Positions & Pay and Performance Reviews as "Soon". `MyPosition.tsx` and `AdminPositions.tsx` still read and write `employee_positions` and `positions`. Benefit and compensation tables are in the database types and in trigger SQL; this audit found no `src/` `.from("benefit_types"|"employee_benefits"|"employee_compensation_history")` call. They can still hold production rows.

**RLS.** Every `public` table created in migrations runs `ENABLE ROW LEVEL SECURITY`. Bid and scope tables (`bid_phases`, `crews`, `bid_items`, `bid_item_activities`, `bid_item_materials`, `job_notes`, `job_exclusions`, `job_unit_pricing`) get four policies each from `EXECUTE format(...)` loops: signed-in read, office/admin write. A text search for `CREATE POLICY` misses those. `activity_equipment` had RLS and was dropped.

Policies and column grants changed many times after the original creates (profiles, schedule, dispatch, contacts, time off). A migration replay is not the same thing as the live policy set if anyone edited policies in the Lovable/Supabase SQL editor. The time-off defect described on `develop` is still the policy in `main`: employees can insert their own requests without forcing `status = 'pending'`, and "cancel own pending" has no `WITH CHECK` on the new row. The forward fix is only the unapplied `develop` candidate.

**Fresh replay also hits:** `20260513013337` alters `realtime.messages`, which the local notes say is not owned by the local migration role.

### 2. Auth

| Piece | Status |
| --- | --- |
| Email + password | Direct Supabase Auth. Sign-up sends `emailRedirectTo: ${window.location.origin}/` and `display_name` metadata. Password UI minimum is 6 characters. `create-employee` requires 8 when an admin sets a password. |
| Google | Lovable OAuth wrapper only. Providers typed in the wrapper: google, apple, microsoft. The UI calls google. |
| Session storage | `brokeredPreviewStorage()` in `previewAuthStorage.ts` posts the session to a Lovable editor parent on `*.lovable.app`, `lovableproject.com`, `gpt-eng.com`, and similar hosts. Other hosts use `localStorage`. |
| New-user trigger | `on_auth_user_created` → `handle_new_user`: profile, `employee` role, employee-contact link or insert. |
| Seeded users | `20260419193344` writes four confirmed email users and identities, then promotes three to `foreman` and sets one `is_driver`. The password is in the file. Treat it as public. Do not replay this file into a new project. |
| Open signup | The sign-in page offers "Create Account" to anyone who can load it. A new project should turn off public signups unless that is intentional. |

**Reconfigure on a new Supabase project**

- Auth site URL and redirect allow-list: production origin, staging origin, and any preview origin. Today the code sends the browser origin, so previews only work if that origin is allowed.
- Google: a Google Cloud OAuth client the company owns. Authorized JavaScript origins and redirect URI must be the new site and `https://<new-ref>.supabase.co/auth/v1/callback`. Replace `lovable.auth.signInWithOAuth` with `supabase.auth.signInWithOAuth`. Lovable's client cannot be assumed transferable.
- Email confirmation, templates, SMTP, and any "send email" auth hook. Auth mail is queued as `auth_emails` and sent by the Lovable email API, so stock Supabase mail is probably not what production uses. Confirm with the auth hook list.
- HIBP and MFA, if `SECURITY.md` is the intended policy.
- Disable the shared-password migration. Rotate those four accounts on the current project before cutover.

### 3. Storage

| Bucket | Public in SQL | Used by |
| --- | --- | --- |
| `handbook` | no | `Handbook.tsx`, signed URL 600s |
| `job-plans` | no | `PlansSection.tsx`, signed URL 300s, TUS |
| `job-photos` | no | `PhotosSection.tsx`, `createSignedUrls` 3600s, TUS |
| `permits` | no | `PermitsSection.tsx`, signed URL 600s |
| `onboarding-templates` | no | SQL only; no current `src/` caller found |
| `onboarding-signed` | no | SQL only |
| `job-estimates` | no | `EstimateUploads.tsx`, signed URL 600s |
| `talk-audio` | no | `Safety.tsx`, `transcribe-toolbox-talk` |
| `talk-media` | **yes** | `generate-toolbox-talk` writes a public URL into `toolbox_talks.image_url` |
| `shop-waivers` | no | `EquipmentRental.tsx` |
| `accident-photos` | no | `AccidentReportDialog.tsx` |
| `job-contracts` | no | `ContractSection.tsx`, signed URL 600s, TUS |
| `job-submittals` | no | `SubmittalsSection.tsx`, signed URL 600s |
| `safety-violation-photos` | no | `SafetyViolationDialog.tsx` |
| `swpppp-reports` | no | `SwpppSection.tsx` and inbound email |

Policies are per-bucket on `storage.objects` (signed-in read for most job files; tighter for accident photos, violation photos, signed docs, and waivers).

`PhotosSection.tsx` and `PlansSection.tsx` hardcode `https://bitogpfplcquovpdjprk.supabase.co` for TUS. `src/lib/resumableUpload.ts` and `ContractSection.tsx` use `VITE_SUPABASE_URL`. A new project breaks plan/photo resumable upload until those two constants change.

**Copy scope:** every object in the 15 buckets, preserving bucket id and object path. Row metadata (`file_path` columns) then keeps working for private files, because the app signs URLs at read time. `toolbox_talks.image_url` stores the absolute public URL of the old project and must be rewritten. Object count and bytes require a storage listing or `storage.objects` export.

### 4. Edge Functions

`supabase/config.toml` sets `verify_jwt` only for five functions. Anything not listed needs the deployed config checked. Supabase CLI default is verify JWT on.

| Function | Role | `verify_jwt` in config | Secrets / external calls |
| --- | --- | --- | --- |
| `process-email-queue` | Drains pgmq, sends via Lovable email | true | `LOVABLE_API_KEY`, optional `LOVABLE_SEND_URL` (default `https://api.lovable.dev`), service role |
| `send-transactional-email` | Renders React Email templates and enqueues | true | service role, anon; office/admin or service role |
| `preview-transactional-email` | Template preview for Lovable | **false** | `LOVABLE_API_KEY` gate in code |
| `handle-email-unsubscribe` | One-click and in-app unsubscribe | **false** | service role |
| `handle-email-suppression` | Bounce/complaint/unsubscribe webhook | **false** | `LOVABLE_API_KEY`, `@lovable.dev/webhooks-js`; comment says Mailgun via Lovable |
| `inbound-swpppp-email` | Inbound SWPPP attachment → job | not set | optional `SWPPPP_INBOUND_SECRET` query secret; service role; writes `swpppp-reports` |
| `daily-celebrations` | Birthday / anniversary notifications, America/New_York | not set | `DAILY_CELEBRATIONS_SECRET` or service role |
| `create-employee` | Contact plus optional auth user (admin) | not set | service role; caller must be admin/office/foreman |
| `convert-employee-contact` | Link a contact to a login | not set | service role |
| `notify-talk-attendees` | SMS the crew a safety-talk link | not set | `LOVABLE_API_KEY`, `LOVABLE_CONNECTOR_TWILIO_API_KEY`, `TWILIO_FROM_NUMBER`, `APP_BASE_URL`. Gateway `https://connector-gateway.lovable.dev/twilio`. Default base URL is a Lovable preview host |
| `generate-toolbox-talk` | AI talk + image | not set | `LOVABLE_API_KEY` → `ai.gateway.lovable.dev`, models `google/gemini-2.5-flash` and `google/gemini-2.5-flash-image` |
| `suggest-safety-topic` | AI topic | not set | same gateway, `gemini-2.5-flash` |
| `extract-foreman-brief` | AI brief from contract file | not set | same |
| `extract-scope-from-contract` | AI scope bullets | not set | same |
| `categorize-document` | AI metadata for uploads | not set | same |
| `speak-toolbox-talk` | TTS | not set | `DEEPGRAM_API_KEY` (`api.deepgram.com`), else `ELEVENLABS_API_KEY` (`api.elevenlabs.io`) |
| `transcribe-toolbox-talk` | STT | not set | `ELEVENLABS_API_KEY`, speech-to-text |
| `complete-safety-talk` | Close a session, email summary | not set | service role, enqueues mail |
| `request-truck` | Truck request + office email | not set | default office mailbox `office@schrex.com` |
| `decide-truck-request` | Approve/decline | not set | service role |
| `request-safety-inspection` | Email York Safety | not set | default `info@yorksafetysolutions.com` |
| `submit-accident-report` | Notify on a report | not set | service role |
| `submit-safety-violation` | Notify on a violation | not set | service role |

Templates in `supabase/functions/_shared/transactional-email-templates/`: new-hire document, time-off approved, safety inspection, truck request submitted, truck request decision, safety talk summary, accident report, safety violation.

### 5. Schedules

| Job | In repo | Live schedule |
| --- | --- | --- |
| `process-email-queue` | Comment only, in `20260420131125_email_infra.sql`. Interval described as 5 seconds. Uses vault name `email_queue_service_role_key`. | **NEEDS** `cron.job` export and vault secret *names* (not values) |
| `daily-celebrations` | Function plus `celebration_log` table. No `cron.schedule`. | **NEEDS** Lovable/Supabase schedule or external cron |
| Other external cron | None found | **NEEDS** a dashboard check so a hidden scheduler is not missed |

`pgmq` queues are database objects and must be recreated before functions run. Queue *contents* at cutover should be drained or discarded on purpose, not half-copied.

### 6. Email

- **Auth mail and transactional mail** share the Lovable queue worker. There is no Resend, Postmark, or SendGrid SDK in the app. Suppression comments name Mailgun as Lovable's provider.
- **Sender:** `noreply@notify.www.schrex.com`. Code comments say the email API looks up that exact domain and that it must be delegated to Lovable nameservers. Moving the app without a new verified domain means mail stops.
- **Unsubscribe:** `/unsubscribe` calls `handle-email-unsubscribe` (`verify_jwt = false`) with a token in `email_unsubscribe_tokens`. RFC 8058 one-click POST is implemented. `suppressed_emails` records bounces, complaints, and unsubscribes.
- **Inbound SWPPP:** webhook function, optional shared secret, parses CloudMailin / Postmark / SendGrid-style payloads, finds a job number in the subject, stores the file. The provider, mailbox, and webhook URL are not in git. `config.toml` does not set `verify_jwt = false` for this function, so the gateway may be rejecting unsigned calls unless Lovable overrode that. **NEEDS** the deployed setting and the inbound provider account.
- **Domains to inventory:** `schrex.com` (people's addresses), `notify.www.schrex.com` (Lovable sending), `www.schrex.com` (implied parent). DNS host is not in the repo.

### 7. Realtime

| Channel | Table | Publication in migrations |
| --- | --- | --- |
| `truck-requests-pending` | `truck_requests` | yes |
| `notifications:<user id>` | `notifications` (filter `user_id`) | yes, replica identity full |
| `wb-<week>` | `whiteboard_tiles` (filter `week_start`) | yes |
| `talk-attendees-<session>` | `toolbox_talk_attendees` | **no** — `Safety.tsx` also polls every 15s |

Confirm `pg_publication_tables` for `supabase_realtime` before cutover. If attendees were added in the dashboard, a migration replay will drop live updates until that publication line is copied. No broadcast or presence channels were found. `realtime.messages` is deny-all for `anon` and `authenticated`.

### 8. Secret and env names

Never copy values into tickets. Names only.

**Browser (Vite, inlined at build)**

| Name | Where |
| --- | --- |
| `VITE_SUPABASE_URL` | client, resumable upload, unsubscribe page |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client, unsubscribe, Safety TTS call |
| `VITE_SUPABASE_PROJECT_ID` | `Safety.tsx` builds the functions URL; also tracked `.env` |

**Edge Function / Supabase platform**

| Name | Where |
| --- | --- |
| `SUPABASE_URL` | almost every function |
| `SUPABASE_ANON_KEY` | user-scoped functions |
| `SUPABASE_SERVICE_ROLE_KEY` | admin client inside functions; also the vault copy named `email_queue_service_role_key` |
| `LOVABLE_API_KEY` | AI gateway, email send, email preview, suppression webhook, Twilio connector auth |
| `LOVABLE_SEND_URL` | optional email API override |
| `LOVABLE_CONNECTOR_TWILIO_API_KEY` | SMS |
| `TWILIO_FROM_NUMBER` | SMS |
| `APP_BASE_URL` | links in safety-talk SMS; default is a Lovable preview URL |
| `DAILY_CELEBRATIONS_SECRET` | cron auth for celebrations |
| `SWPPPP_INBOUND_SECRET` | optional inbound webhook |
| `DEEPGRAM_API_KEY` | TTS |
| `ELEVENLABS_API_KEY` | TTS fallback and transcription |

**Not in the repo, required to operate the new project**

- Database password, pooler string, and service-role key of the new project.
- Google OAuth client id and secret.
- New SMTP or transactional provider key, and DNS for the sender.
- Twilio account the company owns, if SMS stays.
- Deepgram and ElevenLabs keys (re-issue; do not assume Lovable will keep serving them).
- Inbound email provider credentials.
- Whatever Lovable stored only in its secret UI. Export the *names* from the Lovable/Supabase secrets screen and diff them against this list.

`SECURITY.md` says secrets live in Lovable Cloud secret storage. That matches the code: service-role and provider keys are not committed. The publishable client key is committed in `.env`, which is normal for an anon key and still should be rotated when the project changes.

### 9. Lovable-specific dependencies

| Item | Evidence |
| --- | --- |
| `lovable-tagger` | `vite.config.ts` dev plugin; `package.json` devDependency `^1.1.13` |
| `@lovable.dev/cloud-auth-js` | Google sign-in |
| `npm:@lovable.dev/email-js` | `process-email-queue` |
| `npm:@lovable.dev/webhooks-js` | suppression webhook |
| `.lovable/plan.md` | Editor plan for the pay-validation trigger. Not runtime. |
| AI gateway | `https://ai.gateway.lovable.dev/v1/chat/completions` in five functions |
| Twilio connector | `https://connector-gateway.lovable.dev/twilio` |
| Hardcoded hosts | README live URL; `notify-talk-attendees` default `https://id-preview--be4f9bee-f0ea-4d93-8142-1b82027df08c.lovable.app`; preview-auth zones; `index.html` OG image on `storage.googleapis.com/gpt-engineer-file-uploads/...` |
| Hardcoded Supabase ref | `PhotosSection.tsx`, `PlansSection.tsx` |
| Build | `componentTagger()` only when `mode === "development"`. Production `vite build` does not need the tagger at runtime, but the dependency must install unless removed. |

Leaving Lovable means replacing auth, email, AI, and SMS. Weather (`api.open-meteo.com`), maps (Nominatim, OSM, Esri, OSRM, Google Maps links), Divvy, HCSS, Clearstory, and Exactix are ordinary outbound links and are not Lovable.

### 10. Hosting

- Vite 5 + React 18 SPA. Routes are client-side (`react-router-dom` `BrowserRouter`). The host must rewrite unknown paths to `index.html` or refresh on `/jobs/:id`, `/safety/take/:token`, and `/unsubscribe` 404s.
- `npm run build` writes `dist/`. There is no committed CI on `main`. `develop` adds `.github/workflows/verify.yml` for local checks only.
- `VITE_*` must exist in the host's build environment. Changing them requires a rebuild.
- PWA: `public/manifest.webmanifest`, `start_url: "/"`, icon `app-icon.png`.
- No custom domain, no TLS config, and no Lovable domain mapping are in git. Ask Lovable whether `schreiber-hub-central.lovable.app` is the only host or whether a `schrex.com` hostname is also attached.
- `develop` local docs warn that `npm run dev` uses the existing `.env` and can point at production. Keep using that warning.

## Blockers

1. **Repo migrations are not a full schema.** Replaying them on an empty database fails on HR triggers and does not create `email_queue_dispatch`, the email cron body, or any dashboard-only policy edits.
2. **Auth is not a Supabase-only Google provider.** Sessions for Google are minted by Lovable and then stored in the Supabase client. Password hashes and `auth.identities` must be exported and tested. Users who only use Google may have to sign in again and re-link.
3. **Mail, AI, and SMS are Lovable products.** `LOVABLE_API_KEY` will not exist on a company Supabase project. Sender DNS for `notify.www.schrex.com` is documented as Lovable's. AI features stop until another gateway is wired. SMS stops until a company Twilio account is wired.
4. **No staging project exists.** `develop` says this explicitly, and nothing in `main` defines one.
5. **`main` is live.** Lovable syncs `main` both ways. A migration branch must not be merged or pushed there.
6. **Seeded shared password is in git history.** Rotation is required even if hosting does not change. Do not copy that migration into the new project.
7. **Absolute storage URLs and hardcoded project ref.** `toolbox_talks.image_url`, plus TUS URLs in two components, keep pointing at `bitogpfplcquovpdjprk` after the app moves.

## Access and export checklist

Ask Sumanth (Lovable project owner) and, if needed, Lovable support. All exports should be schema or inventory first. Do not pull employee row dumps into this repository.

| Ask | From whom | Why |
| --- | --- | --- |
| Read-only full schema dump (`pg_dump --schema-only`, all schemas used by the app: `public`, `storage`, `auth` function/trigger definitions, `cron`, `pgmq`, `vault` secret *names*, `realtime` publication). No row data, no secret values. | Owner, via Supabase/Lovable SQL or support | Prove parity beyond the three HR tables. Capture `email_queue_dispatch`, grants, and policies actually installed. |
| `cron.job` rows (schedule, command with secrets redacted) and any Lovable scheduled-function list | Owner dashboard | Email worker and celebrations |
| Auth settings export: site URL, redirect URLs, providers enabled, email confirmations, SMTP/hook, password policy, HIBP, MFA counts. `auth.identities` grouped by `provider` only. | Owner | Google and email cutover |
| Auth user export plan: GoTrue-compatible `auth.users` including `encrypted_password`, plus identities, **in a private store**, after a dry run on staging. Not GitHub. | Owner + whoever runs the copy | Password users keep working only if hashes and the same auth schema move together |
| Storage: bucket list with public flag, file size limits, and object count/bytes per bucket. Later, a same-path object copy. | Owner | Size the copy; find files outside the 15 known buckets |
| Secrets screen: names only, diffed against section 8 | Lovable Cloud → secrets | Find keys this repo does not mention |
| Whether Lovable will transfer or detach the Supabase project versus requiring a new project | Lovable support | A transfer avoids auth-hash and storage-URL pain. This audit assumes a new project because that is the stated goal. |
| DNS host for `schrex.com` and any Lovable nameserver delegation on `notify.www.schrex.com` | Domain owner | Email and, later, the app hostname |
| Inbound SWPPP provider, destination address, and current webhook URL | Whoever forwards those emails | Point the webhook at the new function and set `verify_jwt` off plus a secret |
| Custom domain on the Lovable app, if any | Lovable project settings | Cutover DNS |
| Confirmation that production still has the three HR tables and whether they contain rows (counts only) | Owner, read-only | Empty tables are a smaller cutover; nonempty tables are payroll records with a 6-year retention note in `SECURITY.md` |

The 2026-10-16 file on `develop` (`local/reference/schema_benefits_positions_timeoff.sql`, SHA-256 `30baff2ad62f1a9f4bb69d71c56b3d851db92d3a2439c798b0345120aba6ce8a`) is a partial catalog extract, not this dump. It is not a backup.

## (a) Independent staging

Stand up staging before any production copy.

1. **New Supabase project** in the company's own org, Postgres 17, region chosen explicitly. Empty. Do not link the Lovable CLI at this repo.
2. **Schema:** start from a schema-only dump of production, not from `supabase/migrations` alone. If the dump is delayed, load migrations only after inserting a reviewed HR bootstrap *ahead* of `20260421010923`, and skip `20260419193344` and the local-incompatible realtime ownership change. Then diff the result against the dump before trusting it.
3. **Host:** Vercel, Netlify, or Cloudflare Pages are all enough. Requirements: Node build of Vite, `dist` as the output, SPA fallback to `index.html`, and build-time `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` for the *staging* project. Preview deployments should use the same staging Supabase project or a third disposable one, never production.
4. **Branch previews:** connect the host to GitHub and allow previews from `develop` and `cursor/*`. Point Lovable at nothing. Keep production `main` on Lovable until cutover.
5. **Seed:** synthetic users only (`employee@`, `other@`, `admin@` style). `develop`'s `local/seed.sql` is a starting point and still needs a review so it cannot target production. No employee rows, no SSN, no pay rates from production.
6. **Google:** a separate OAuth client named for staging, with the staging hostname and `http://localhost:8080` only.
7. **Integrations:** stub or disable AI, SMS, inbound mail, and outbound mail. Use the host's email sandbox or a sink. Do not put production `LOVABLE_API_KEY` into staging.
8. **Auth policy:** turn off public signup on staging and on the future production project. Create users through `create-employee` or an invite flow.
9. **`develop` tooling** (`bun run dev:local`, disposable Docker) can stay as a laptop/CI check. It is not staging. Its own notes say Edge Functions and Realtime are off.

## (b) Phased migration and recovery

Keep https://schreiber-hub-central.lovable.app on the current Supabase project until the new host has passed the checks below. DNS is the last switch, and it stays reversible.

### Phase 0 — Inventory (this document plus the checklist)

Finish the exports above. Freeze a written list of buckets, cron jobs, secret names, auth providers, and redirect URLs. Decide transfer-versus-new-project with Lovable support before building tooling.

### Phase 1 — Schema parity

Apply the schema-only dump to staging. Compare, at least:

- table and column names against `types.ts` (expect 60 tables)
- enums, views (`positions_public`, `employee_contacts_directory`)
- functions, including `email_queue_dispatch`, `handle_new_user`, `has_role`, `get_employee_contact_sensitive`, `list_employee_directory`
- triggers on the three HR tables and `auth.users`
- RLS enabled and policy names
- publication tables
- storage buckets and policies
- extensions `pg_cron`, `pg_net`, `pgmq`, `supabase_vault`

Do not promote `local/candidate-migrations/20261016210000_time_off_request_permissions.sql` in the same change as the move. It is a behavior fix and needs its own review.

### Phase 2 — Staging rehearsal

Deploy the SPA to the staging host from a branch, with Lovable packages still installed so the build matches, but with Google pointed at Supabase Auth. Exercise, with synthetic data:

- email/password sign-in, rejected public signup, admin-created user, profile and `employee` role trigger
- Google sign-in on the staging hostname
- one private upload and a signed URL (plans or handbook)
- one public `talk-media` image URL rewritten to the staging project
- realtime on notifications and truck requests
- time-off create and admin approve
- a queued email that lands in a sink, including unsubscribe
- a celebrations dry run
- SMS and AI either stubbed or called with staging keys

`PhotosSection` / `PlansSection` hardcoded URL must be fixed on this branch before the rehearsal, or those uploads will hit production.

### Phase 3 — Data, auth, and storage dry run

- Copy `public` data into staging with a maintenance window practice run. Preserve primary keys so storage paths and foreign keys still match.
- Copy `auth.users` / `auth.identities` into a throwaway staging auth schema. Sign in as a password user. Record whether Google identities exist and which provider string they use.
- Copy storage objects same-path. Rewrite stored absolute URLs (`toolbox_talks.image_url`, and any `video_url` that points at the old project).
- Compare row counts and a few checksums. Then wipe staging business data. The dry run is not the cutover database if it contains real payroll data and the staging keys are loose.

Payroll, SSN, and bank fields are in this database. The dry-run target needs the same RLS, restricted column grants, and a private network path. Do not load that dump into a laptop database.

### Phase 4 — Cutover

1. Pick a low-traffic window. Tell the crew the app will be read-only for the copy.
2. Snapshot the Lovable project (database backup Lovable/Supabase can restore, plus a storage inventory).
3. Stop writers: maintenance page on the new host only after DNS; until then, avoid dual writes. Do not delete the Lovable app.
4. Final incremental copy of rows changed since the dry run, auth users, and storage objects.
5. Deploy functions to the new project with the new secrets. Recreate cron only after the function URL and vault key exist. Set `verify_jwt = false` only on unsubscribe, suppression, preview, inbound SWPPP, and celebrations-if-it-uses-a-cron-secret.
6. Point the new host's production env at the new Supabase project and deploy.
7. Change DNS for the chosen app hostname. Lower TTL the day before. Leave `schreiber-hub-central.lovable.app` on the old project.
8. Google Cloud: add the production redirect URI before the DNS switch.

### Rollback

- DNS back to Lovable. Old project was not written by the new app if the env vars never pointed production traffic at it before the switch.
- If a few users did create rows only on the new project, export those rows before reversing DNS.
- Do not decommission the Lovable Supabase project, OAuth client, or sender DNS until the post-cutover checks have held for a full work week, including a payroll-related read by an admin and a password reset.
- Keep the old project backup. `SECURITY.md` calls for 6-year retention of payroll records.

### Phase 5 — Post-cutover checks

- Password sign-in and Google sign-in for one user of each kind.
- A foreman sees only their own pay row; an admin sees `pay_audit_log`; another employee cannot read it.
- Schedule, jobs, a signed file download, a truck request, a time-off request, a notification arriving over realtime.
- Outbound mail from the new domain, unsubscribe, and one inbound SWPPP test message.
- Celebrations job ran once.
- AI and SMS either work on the new keys or are visibly disabled.
- Old Lovable URL still loads the old app, so rollback remains real.
- Error logs and auth failure rate for the first day.

## Risks to plan around

- **Password hashes** move only with a compatible `auth.users` copy into the same GoTrue major version. A CSV of emails is not enough. Users then need resets.
- **OAuth identities** are tied to the Google client and to however Lovable created the Supabase user. Budget for a re-link. Apple/Microsoft are in the wrapper types and unused by the button; confirm the identity export anyway.
- **Open signup** on the old and new projects creates an `employee` role. Close it before the new project is on a public hostname.
- **Shared password in git history** remains even after rotation. Rotation still matters because those hashes were generated from a password anyone with the repo can read.
- **Storage URLs** in `image_url` break when the project ref changes. Private `file_path` values survive a same-path copy.
- **Hardcoded project URL** in two upload components will silently keep writing to Lovable's project if the env is switched and those lines are not.
- **Email domain delegation** can outlive the app move and keep mail on Lovable, or break mail if nameservers are cut early.
- **AI credits** disappear with the Lovable key. Safety-talk generation, contract extraction, and document categorization are the features that stop.
- **Dual write** if Lovable `main` and the new host share one database during a partial move. Avoid that. Staging and production projects stay separate.
- **Schema drift will grow** if Lovable keeps editing `main` during the staging work. Re-diff migrations and types immediately before cutover.
- **`develop` is not production.** It has local tooling and a lint/CI trail. Merging it to `main` would ship a large unreleased branch through Lovable. It is a useful input to staging, not a release.
