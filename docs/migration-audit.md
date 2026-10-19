# Migration audit — Schreiber field app off Lovable

Read-only audit of GitHub `main` at `5a81add` ("Lovable update"), compared with `origin/develop` at `936bef8`. Updated with authorized read-only Lovable dashboard inspection and SELECT-only catalog/count queries on 2026-10-19. No infrastructure, settings, application records, or scheduler history were changed; no full export was started. No secret values or employee rows are recorded here.

**Live primary app (verified in dashboard):** https://app.schreiberexcavating.com
**Lovable fallback:** https://schreiber-hub-central.lovable.app
**Lovable project id (from README):** `be4f9bee-f0ea-4d93-8142-1b82027df08c`
**Supabase project ref:** `bitogpfplcquovpdjprk` — verified in `supabase/config.toml` and in the tracked `.env` URL/project id on both branches. The host is `*.supabase.co`.

`main` is what Lovable two-way syncs. `develop` is 21 commits ahead of `main` and was not merged (PR #9, "Develop", is closed). Do not merge this audit, or `develop`, into `main`.

**Conclusion:** the export checklist below is the immediate next step. Cutover is not justified yet. Rebuilding from the repo migrations alone leaves an incomplete database, and logins and email still need a tested replacement.

## Export preparation follow-up — 2026-10-19

See [private export and independent restore preparation](migration-export-rehearsal.md)
for export steps and acceptance criteria. The user approved local private storage
at `/Users/sumanththota/Schrex/archive`; a database export was subsequently requested,
but its download link is unavailable and import remains paused. Storage archives
were downloaded privately; completeness and an independent restore are not proven.
The separate `hub-rehearsal` destination is recorded in
[destination audit](migration-destination-audit.md); its read-only connection check
succeeded. Earlier opening observations describe the original audit, before export
preparation. No source data or scheduler history was modified.

DNS access is pending. The accepted email plan is Supabase Auth SMTP via Postmark
and the existing notification queue. Additional delivery-tracking infrastructure
is paused. Runtime preparation described in companion documents is separate draft
review work, not activation or a prerequisite to DNS/password-reset testing.

## How findings are labeled

Every finding below is tagged with one of:

| Label | Meaning |
| --- | --- |
| **Production (main)** | True of the Lovable-synced branch. The same code is what production runs, assuming Lovable is still on `main`. |
| **Fixed on develop, not released** | Changed on `develop` only. Not on `main`, and not released. |
| **Live verified (2026-10-19)** | Observed dashboard setting or aggregate/catalog query; a snapshot, not a restore test. |
| **Both** | Re-checked and the same on `main` and `develop`. |

`supabase/migrations` is identical on both branches. A finding that lives only in those files is **Both**.

Claims that need the live dashboard or DNS are marked **NEEDS ACCESS to confirm**. Code can show what the app *calls*. It cannot show what the hosted project currently *allows*.

## What the live inspection changes

The intention remains: keep the app and its business records, while moving hosting, Supabase, authentication and integrations into company-owned accounts. Starting fresh applies to **scheduler execution history**, not employee records, Auth users, files, or the schema.

```text
Lovable today (kept running)
       |
       +--> Read-only inventory + private, restore-tested exports
       |                         |
       |                         v
       |    Company-owned Supabase + managed static frontend
       |       1. Synthetic staging: prove app and integrations
       |       2. Restricted rehearsal: prove data/auth/file copy
       |       3. Approved freeze, final copy, validation, DNS switch
       |                         |
       +<-- Recovery window -----+  Reconcile new writes before rollback

Copy: schema, business data, users, files, job definitions and required state
Skip: old cron.job_run_details rows; destination builds fresh run history
```

**Verified snapshot:** 25 Auth users; 25 identities, all `email`; 60 public tables with RLS enabled; 15 buckets holding 23 objects totaling 66,632,006 metadata bytes (66.6 MB). All three missing HR tables exist but currently contain zero rows. This does not mean other employee/pay tables are empty. Dashboard region is US East (Ohio), database version 17.6.1.104, and Edge Functions count is 23. Deployed function sources and gateway settings have not been compared to git. Installed extensions observed: pg_cron 1.6.4, pg_net 0.20.0, pgmq 1.5.1, supabase_vault 0.3.1, pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0 and uuid-ossp 1.1.

**Export path found:** Advanced settings offers a downloadable database export and says storage files must be downloaded separately. Only the export modal was inspected. Availability is not proof that it includes password hashes, all schemas, or a restorable backup; those remain rehearsal requirements. Account access alone does not establish company ownership of every dependency.

**Practical change:** prefer a full copy during a measured maintenance window over building incremental copy tooling immediately. The storage inventory is small, and nearly all allocated database space is scheduler history. Measure actual export/restore time before committing to downtime.

## Where the notes live

| Document | On GitHub `main` | On GitHub `develop` | `codex/local-development-foundation` |
| --- | --- | --- | --- |
| `AGENTS.md` | Absent | Present | Not a current branch |
| `DEVELOPMENT_PROGRESS.md` | Absent | Present | Not a current branch |
| `local/README.md` | Absent | Present | Not a current branch |

Remote branches at audit time were `main` and `develop` (this audit branch is additional). The foundation work was merged into `develop` by PR #7 (`codex/verification-cleanup`, includes `9ce17fd`). PR #8 (`codex/time-off-browser-test`) is also merged. `DEVELOPMENT_PROGRESS.md` is stale on both points: it still says the foundation lives on `codex/local-development-foundation` and that PR #8 is unmerged. **Fixed on develop, not released** as documentation; those files are not on `main`.

Also on `develop` only: `local/AUDIT.md`, `local/SCHEMA_RECONCILIATION.md`, `local/SCHEMA_REQUEST.md`, `local/hr-bootstrap.sql`, `local/reference/schema_benefits_positions_timeoff.sql`, `local/candidate-migrations/20261016210000_time_off_request_permissions.sql`.

Those notes are partly right and partly outdated:

- Right, and re-verified: the three HR tables are in generated `types.ts` on **Both** branches and are missing as `CREATE TABLE` from `supabase/migrations` on **Both**. `develop` holds a local reconstruction in `local/hr-bootstrap.sql` (**Fixed on develop, not released**). That file is not a production migration. A 2026-10-16 catalog export (header says Postgres 17.6) was the input. Local checks described in the notes were synthetic and are not production parity.
- Stale: the reconciliation doc says the time-off permission fix is `supabase/migrations/20261016210000_...sql`. It is not. It sits only in `local/candidate-migrations/` on `develop` (**Fixed on develop, not released**) and is not in the migration history on either branch.
- Not re-run for this audit: Docker local backend, the "60/60 tables" inventory command, or browser tests. The table-name gap itself is confirmed by reading migrations and `src/integrations/supabase/types.ts` on both branches.

## Inventory

Classification: **VERIFIED** means the claim is in the git tree named by the branch label. **NEEDS ACCESS OR EXPORT** means the repo cannot prove the live value. **BLOCKER** means cutover cannot be done safely until that item is resolved.

| Area | Verified evidence | Remaining migration gate |
| --- | --- | --- |
| Schema | 78 identical migration files; 60 live public tables; three HR creates absent from history; live email dispatch/wake functions and queue triggers also need portable definitions | Complete schema export and restore comparison, including grants, policies, functions and triggers |
| Auth | Email/Google enabled; signup enabled; 25 users and 25 email identities; Lovable Google wrapper in both branches | Password-hash export and sign-in rehearsal; independent Google client; complete Auth settings |
| Storage | 15 live buckets; 23 objects, 66.6 MB metadata size; only talk-media public | Copy file contents and verify checksums; rewrite absolute URLs; use develop upload fix |
| Edge Functions | 23 repo functions and 23 in dashboard; five use Lovable AI | Compare deployed sources/JWT settings; replace provider dependencies |
| Scheduled jobs | One active daily-celebrations cron; email jobs are dynamically armed by queue triggers | Export and adapt dispatch/wake behavior; investigate external schedules |
| Email | Dashboard sender @notify.www.schrex.com; Lovable queue/sender code | DNS control, replacement mail delivery and Auth hook, inbound routing |
| Realtime | Live publication contains notifications, truck_requests, whiteboard_tiles only | Test destination subscriptions; attendee publication absent in source too |
| Secrets | Three custom names visible; full code requirements below | Securely provision destination keys; visible list is not proof of all runtime configuration |
| Lovable dependencies | Auth wrapper, email/webhook packages, AI gateway, Twilio connector, preview integration | Replace or deliberately disable each runtime feature |
| Hosting | Vite SPA; primary domain app.schreiberexcavating.com confirmed | Company-owned host, SPA fallback, DNS access; no independent staging verified |

### 1. Schema, RLS, and pay / HR data

Branch: **Both**, except the local HR reconstruction, which is **Fixed on develop, not released**.

`src/integrations/supabase/types.ts` reports PostgREST `14.5` on both branches. The `develop` catalog note says Postgres 17.6. The live Cloud dashboard now reports PostgreSQL 17.6.1.104; the runtime PostgREST version was not independently checked.

**In types on both branches, and not created by `supabase/migrations` on either branch**

| Object | Branch | Why it matters |
| --- | --- | --- |
| `benefit_types` | **Both** missing from migration history. Definitions reconstructed on **develop** in `local/hr-bootstrap.sql` only. | Lookup for benefits. Columns in types: `name`, `description`, `default_annual_value`, `is_active`, `sort_order`, timestamps. |
| `employee_benefits` | Same split. | Per-user benefit amounts (`annual_value`, `effective_date`, `end_date`, `benefit_type_id`). Triggers in `20260421010923` and `20260421020148` target this table on **Both**. |
| `employee_compensation_history` | Same split. | `base_salary`, `bonus`, `benefits_value`, generated `total_compensation`, `year`. Same trigger files on **Both**. |
| `email_queue_dispatch()` | **Both** | Absent from migration SQL; live body inspected with string literals redacted. Its companion `email_queue_wake()` and queue triggers must also be exported; see schedules. |

`local/hr-bootstrap.sql` on `develop` reconstructs the three tables from the 2026-10-16 export, including RLS, and normalizes `total_compensation` to `GENERATED ALWAYS AS ((base_salary + bonus) + benefits_value) STORED`. The file header says it is local only and must not be deployed against existing production tables. Live catalogs confirm the stored generated expression. Role grants and default privileges are now inspectable and include broad anon/authenticated/service_role privileges; RLS remains relevant to row access. Preserve exact table and column grants in the full export rather than assuming the partial extract is complete. Do not run the bootstrap against production.

**Pay and HR storage (VERIFIED in migrations plus types on Both)**

| Data | Where | Access in SQL |
| --- | --- | --- |
| Pay rates and salaried flag | `employee_positions` | RLS: employee reads own rows; admin writes. Audit trigger → `pay_audit_log`. |
| Pay bands | `positions.min_pay_rate`, `max_pay_rate` | Admin select policy. `positions_public` omits pay bands (`security_invoker`). |
| Comp history and benefits | tables above | Policies are in the `develop` local reconstruction, not in `supabase/migrations` on either branch. Live HR policies were inspected; a complete portable schema comparison is still required. |
| Audit | `pay_audit_log` | Admin `SELECT` only in migrations. No client write policies in SQL. |
| SSN, bank, license number, emergency contact, termination | `employee_contacts` | Column `SELECT` revoked from `anon` and `authenticated` (`20260513012349`). `get_employee_contact_sensitive` is security definer and office/admin only. |
| Referral fees | `referrals.fee_amount`, `paid_at` | Column select revoked from client roles. |

`SECURITY.md` (dated 2026-04-21, **Both**) matches this design. It also claims HIBP leaked-password rejection, required email confirmation, and admin MFA. The live dashboard confirms HIBP checking and required email confirmation. MFA enforcement/enrollment remains unverified.

The HR page on **Both** marks Positions & Pay and Performance Reviews as "Soon". `MyPosition.tsx` and `AdminPositions.tsx` still read and write `employee_positions` and `positions`. This audit found no `src/` `.from("benefit_types"|"employee_benefits"|"employee_compensation_history")` call on either branch. Live exact counts are zero for each of these three tables. Other employee/pay tables still require preservation.

**RLS.** Every `public` table created in migrations runs `ENABLE ROW LEVEL SECURITY` (**Both**). Bid and scope tables (`bid_phases`, `crews`, `bid_items`, `bid_item_activities`, `bid_item_materials`, `job_notes`, `job_exclusions`, `job_unit_pricing`) get four policies each from `EXECUTE format(...)` loops: signed-in read, office/admin write. A text search for `CREATE POLICY` misses those. `activity_equipment` had RLS and was dropped.

Policies and column grants changed many times after the original creates (profiles, schedule, dispatch, contacts, time off). A migration replay is not the same thing as the live policy set if anyone edited policies in the Lovable/Supabase SQL editor (**NEEDS ACCESS**). The time-off policies in `supabase/migrations` on **Both** let employees insert their own requests without forcing `status = 'pending'`, and "cancel own pending" has no `WITH CHECK` on the new row. Live policy inspection confirms these same time-off conditions. All 60 public tables have RLS enabled (none forced); that alone does not prove authorization correctness. Compensation history also has two validation triggers calling `validate_comp_history`, which should be captured before deciding whether to consolidate them separately. The forward fix is only the unapplied `develop` candidate (**Fixed on develop, not released**).

**Fresh replay also hits:** `20260513013337` alters `realtime.messages` (**Both**). The local notes say this statement fails on a local CLI database because that table is not owned by the migration role.

### 2. Auth

Branch: **Both**, with the local-only Google disable on **develop**.

| Piece | Branch | Status |
| --- | --- | --- |
| Email + password | **Both** | Direct Supabase Auth. Sign-up sends `emailRedirectTo: ${window.location.origin}/` and `display_name` metadata. Password UI minimum is 6 characters. `create-employee` requires 8 when an admin sets a password. |
| Google | **Both** in production code paths | Lovable OAuth wrapper only. Providers typed in the wrapper: google, apple, microsoft. The UI calls google. **Fixed on develop, not released:** the button is disabled when `VITE_LOCAL_BACKEND=true`. |
| Session storage | **Both** | `brokeredPreviewStorage()` posts the session to a Lovable editor parent on `*.lovable.app`, `lovableproject.com`, `gpt-eng.com`, and similar hosts. Other hosts use `localStorage`. |
| New-user trigger | **Both** | `on_auth_user_created` → `handle_new_user` (final version in `20260425202240`): profile, `employee` role, employee-contact link or insert. |
| Seeded users | **Both** | `20260419193344` writes four confirmed email users and identities, then promotes three to `foreman` and sets one `is_driver`. The password is in the file. Treat it as public. Do not replay this file into a new project. `develop` local prepare replaces this file with a comment for disposable databases only. |
| Signup UI | **Both** | The sign-in page calls `supabase.auth.signUp` and offers "Create Account". **Live verified:** Disable sign-up is off, so public signup is enabled. In code, `handle_new_user` assigns `employee`. |

**Google identity continuity.** The wrapper exchanges a Lovable result for a Supabase session via `setSession`. Live aggregates show 25 users and 25 identities, all with provider `email`; no Google-provider identities were present. This does not establish whether anyone used brokered Google login or how that broker mapped an account. Continuity has to be tested on the migration-rehearsal project. Relinking accounts is a contingency if that test fails, not an assumed requirement.

**Reconfigure on a new Supabase project**

- Auth site URL and redirect allow-list: production origin, staging origin, and any preview origin. The code sends the browser origin, so each origin in use has to be allowed.
- Google: a Google Cloud OAuth client the company owns. Authorized JavaScript origins and redirect URI must include the new site and `https://<new-ref>.supabase.co/auth/v1/callback`. The app code that calls `lovable.auth.signInWithOAuth` has to call `supabase.auth.signInWithOAuth` on the new project. Lovable's client is not assumed to be transferable.
- Email confirmation, templates, SMTP, and any "send email" auth hook. Auth mail is queued as `auth_emails` in SQL and the worker sends through the Lovable email API. **NEEDS ACCESS to confirm** the live hook. Stock Supabase mail may differ from what production uses.
- HIBP is enabled; MFA still needs verification. Secure email change is enabled, anonymous sign-in disabled, reauthentication for password changes disabled, OTP expiry 3,600 seconds and OTP length 8. The dashboard minimum password length was not verified. Only Email and Google were enabled among the displayed providers.
- Skip the shared-password migration. Rotate those four accounts on the current project before cutover.

### 3. Storage

Bucket definitions and policies: **Both**.

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

**Upload base URL, re-verified:**

| File | Production (main) | develop |
| --- | --- | --- |
| `src/components/jobs/PhotosSection.tsx` | Hardcodes `https://bitogpfplcquovpdjprk.supabase.co` for TUS | `import.meta.env.VITE_SUPABASE_URL` (**Fixed on develop, not released**) |
| `src/components/jobs/PlansSection.tsx` | Same hardcoded host | `import.meta.env.VITE_SUPABASE_URL` (**Fixed on develop, not released**) |
| `src/lib/resumableUpload.ts`, `ContractSection.tsx` | `VITE_SUPABASE_URL` | `VITE_SUPABASE_URL` (**Both**) |

Production plan/photo resumable uploads follow the hardcoded host until `main` contains the `develop` change or an equivalent fix. A staging build of `main` would still upload those files to the production project.

**Copy scope:** every object in the 15 buckets, preserving bucket id and object path, including a way to record deletions. Row metadata (`file_path` columns) then keeps working for private files, because the app signs URLs at read time. `toolbox_talks.image_url` stores the absolute public URL (**Both**) and has to be rewritten when the project ref changes. Live metadata inventory:

| Bucket | Objects | Metadata bytes |
| --- | ---: | ---: |
| job-plans | 2 | 10,599,363 |
| talk-media | 10 | 16,165,323 |
| talk-audio | 2 | 3,282,292 |
| job-contracts | 2 | 35,766,330 |
| safety-violation-photos | 2 | 38,200 |
| shop-waivers | 4 | 52,395 |
| job-photos | 1 | 728,103 |
| Remaining eight buckets listed above | 0 | 0 |
| **Total** | **23** | **66,632,006** |

Live bucket visibility matches the SQL. Global upload limit is displayed as 2 GB; job-plans has a 524,288,000-byte bucket limit (500 MiB). This inventory does not verify downloadable contents or checksums.

### 4. Edge Functions

Branch: **Both**. `supabase/config.toml` sets `verify_jwt` only for five functions. Anything not listed needs the deployed config checked (**NEEDS ACCESS**). Supabase CLI default is verify JWT on.

| Function | Role | `verify_jwt` in config | Secrets / external calls |
| --- | --- | --- | --- |
| `process-email-queue` | Drains pgmq, sends via Lovable email | true | `LOVABLE_API_KEY`, optional `LOVABLE_SEND_URL` (default `https://api.lovable.dev`), service role. Depends on the sending-domain configuration, not on the AI or SMS credentials. |
| `send-transactional-email` | Renders React Email templates and enqueues | true | service role, anon; office/admin or service role |
| `preview-transactional-email` | Template preview for Lovable | **false** | `LOVABLE_API_KEY` gate in code |
| `handle-email-unsubscribe` | One-click and in-app unsubscribe | **false** | service role |
| `handle-email-suppression` | Bounce/complaint/unsubscribe webhook | **false** | `LOVABLE_API_KEY`, `@lovable.dev/webhooks-js`; comment says Mailgun via Lovable |
| `inbound-swpppp-email` | Inbound SWPPP attachment → job | not set | required `SWPPPP_INBOUND_SECRET` (the optional source comment is stale); service role; writes `swpppp-reports`. This is a writer during any freeze. |
| `daily-celebrations` | Birthday / anniversary notifications, America/New_York | not set | `DAILY_CELEBRATIONS_SECRET` or service role. Writer if a schedule exists. |
| `create-employee` | Contact plus optional auth user (admin) | not set | service role; caller must be admin/office/foreman |
| `convert-employee-contact` | Link a contact to a login | not set | service role |
| `notify-talk-attendees` | SMS the crew a safety-talk link | not set | `LOVABLE_API_KEY`, `LOVABLE_CONNECTOR_TWILIO_API_KEY`, `TWILIO_FROM_NUMBER`, `APP_BASE_URL`. Gateway `https://connector-gateway.lovable.dev/twilio`. Default base URL is a Lovable preview host. SMS does not depend on the email sending domain. |
| `generate-toolbox-talk` | AI talk + image | not set | `LOVABLE_API_KEY` → `ai.gateway.lovable.dev`, models `google/gemini-2.5-flash` and `google/gemini-2.5-flash-image` |
| `suggest-safety-topic` | AI topic | not set | same AI gateway, `gemini-2.5-flash` |
| `extract-foreman-brief` | AI brief from contract file | not set | same AI gateway |
| `extract-scope-from-contract` | AI scope bullets | not set | same AI gateway |
| `categorize-document` | AI metadata for uploads | not set | same AI gateway |
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

**Live verified:** `cron.job` contained one active job, `daily-celebrations`, scheduled `0 12 * * *`. `cron.timezone` is GMT: noon UTC means 8 AM New York during daylight saving and 7 AM in standard time. External schedulers remain unverified.

Email scheduling is dynamic. Live `public.email_queue_wake()` is attached to enabled triggers on `pgmq.q_auth_emails` and `pgmq.q_transactional_emails`. It uses an advisory lock, creates the dispatch cron when absent, and requests an immediate worker invocation. `public.email_queue_dispatch()` checks queue state, removes the cron when both queues remain empty under the lock, honors retry cooldown, and invokes the worker using a Vault key. Bodies were inspected with string literals redacted; no credentials were copied. Both functions are security definer, owned by postgres, and their observed execute ACL includes anon, authenticated and service_role. Export/review these privileges rather than assuming defaults.

The two working queues and their two dead-letter queues were all empty at inspection. An absent email cron at this idle snapshot is therefore expected, not proof of missing infrastructure. The repo comment describing a five-second cron is insufficient to reconstruct the deployed wake/dispatch lifecycle. Preserve or deliberately replace the functions, queue triggers, schedule behavior, cooldown, Vault references and worker together.

#### Scheduler history: useful evidence, not required migration payload

- `cron.job_run_details` allocated **5,082,685,440 bytes**, compared with **5,102,193,811 bytes** for the database at the SQL snapshot: about **99.6%**. Dashboard usage separately displayed 5.66 GB of 8 GB. Allocation is not logical export size or exact live row volume.
- Latest 1,000 runs by run ID: 889 email-dispatch successes on July 1 (888 under job ID 3, one under ID 5) and 111 daily-celebrations successes from July 1 through October 19. SQL success does not establish successful HTTP delivery or email receipt.
- Earliest retained run by ID was April 20. Latest run ID was 1,234,237, **not an exact row count**. Catalog row estimates were unusable. No full historical aggregate was run.
- 888 of the sampled 1,000 commands contained authorization/Bearer markers. Raw command text is potentially sensitive and must not be included in the report or ordinary logs.

**Recommended migration scope, following the scheduler-history discussion:** start destination scheduler history empty. Exclude the **data** of `cron.job_run_details` from the restore, while retaining required extension/schema and job configuration. Leave source history untouched during the recovery window; optionally preserve a sanitized operational summary. This does not authorize source deletion or dropping any tables. Do not apply this exclusion to `celebration_log`, `email_send_log`, suppression/unsubscribe records, queue contents or business audit logs: these can prevent duplicate sends or preserve user choices and need an explicit migration policy.

During a freeze, unscheduling alone is insufficient: queue triggers can re-arm email processing. Stop enqueue paths and control wake triggers/worker invocation as part of the rehearsed freeze. Keep copied outbound behavior disabled until destination configuration is ready.

### 6. Email, AI, and SMS are separate

Branch: **Both** for the code paths below.

| Dependency | What it needs | What it does not need |
| --- | --- | --- |
| Email | Sending-domain configuration for `notify.www.schrex.com` as `SENDER_DOMAIN`, plus `LOVABLE_API_KEY` / `LOVABLE_SEND_URL` for the current sender. A source comment says the domain must match a subdomain delegated to Lovable nameservers. **NEEDS ACCESS to confirm** that delegation in DNS. | The AI gateway and the Twilio connector. |
| AI | `LOVABLE_API_KEY` and `https://ai.gateway.lovable.dev` for five functions (toolbox talk text and image, safety topic, foreman brief, scope extraction, document categorization). | The email sending domain. |
| SMS | `LOVABLE_API_KEY`, `LOVABLE_CONNECTOR_TWILIO_API_KEY`, `TWILIO_FROM_NUMBER`, and `https://connector-gateway.lovable.dev/twilio` in `notify-talk-attendees`. | The email sending domain. |
| Speech | `DEEPGRAM_API_KEY` and `ELEVENLABS_API_KEY` against those vendors' own APIs. | Lovable's email domain. The Lovable key is not read by these two functions. |

- **Auth mail and transactional mail** share the Lovable queue worker in code. There is no Resend, Postmark, or SendGrid SDK in the app. Suppression comments name Mailgun as Lovable's provider (**NEEDS ACCESS** for the live provider).
- **Unsubscribe:** `/unsubscribe` calls `handle-email-unsubscribe` (`verify_jwt = false`) with a token in `email_unsubscribe_tokens`. RFC 8058 one-click POST is implemented. `suppressed_emails` records bounces, complaints, and unsubscribes.
- **Inbound SWPPP:** webhook function, mandatory shared secret in the handler on both branches, parses CloudMailin / Postmark / SendGrid-style payloads, finds a job number in the subject, stores the file. The provider, mailbox, and webhook URL are not in git (**NEEDS ACCESS**). `config.toml` does not set `verify_jwt = false` for this function. The deployed gateway setting is **NEEDS ACCESS to confirm**.
- **Domains to inventory:** `schrex.com` (people's addresses), `notify.www.schrex.com` (sender in code), `www.schrex.com` (implied parent). DNS host is not in the repo (**NEEDS ACCESS**).

### 7. Realtime

Branch: **Both** for client code and migration SQL.

| Channel | Table | Publication SQL in migrations |
| --- | --- | --- |
| `truck-requests-pending` | `truck_requests` | yes |
| `notifications:<user id>` | `notifications` (filter `user_id`) | yes, replica identity full |
| `wb-<week>` | `whiteboard_tiles` (filter `week_start`) | yes |
| `talk-attendees-<session>` | `toolbox_talk_attendees` | no `ALTER PUBLICATION` in git. `Safety.tsx` also polls every 15s. |

**Live verified:** `supabase_realtime` contains exactly `notifications`, `truck_requests`, and `whiteboard_tiles`; `toolbox_talk_attendees` is absent. Preserve this baseline and test Realtime independently; adding attendees would be a separately reviewed behavior change. No broadcast or presence channels were found in app code. `realtime.messages` is deny-all for `anon` and `authenticated` in `20260513013337` (**Both**).

### 8. Secret and env names

Branch: **Both**. Never copy values into tickets. Names only.

**Browser (Vite, inlined at build)**

| Name | Where |
| --- | --- |
| `VITE_SUPABASE_URL` | client, resumable upload, unsubscribe page. On `develop`, also the plan/photo TUS endpoints. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client, unsubscribe, Safety TTS call |
| `VITE_SUPABASE_PROJECT_ID` | **main:** `Safety.tsx` builds the functions URL; **develop:** Safety uses `VITE_SUPABASE_URL`. Also tracked `.env` |
| `VITE_LOCAL_BACKEND` | **Fixed on develop, not released.** When `"true"`, Google sign-in is disabled in the UI. |

**Edge Function / Supabase platform**

| Name | Where |
| --- | --- |
| `SUPABASE_URL` | almost every function |
| `SUPABASE_ANON_KEY` | user-scoped functions |
| `SUPABASE_SERVICE_ROLE_KEY` | admin client inside functions; also the vault copy named `email_queue_service_role_key` |
| `LOVABLE_API_KEY` | AI gateway, email send, email preview, suppression webhook, Twilio connector auth. One key name, several products. |
| `LOVABLE_SEND_URL` | optional email API override |
| `LOVABLE_CONNECTOR_TWILIO_API_KEY` | SMS |
| `TWILIO_FROM_NUMBER` | SMS |
| `APP_BASE_URL` | links in safety-talk SMS; default is a Lovable preview URL |
| `DAILY_CELEBRATIONS_SECRET` | cron auth for celebrations |
| `SWPPPP_INBOUND_SECRET` | required inbound webhook authentication |
| `DEEPGRAM_API_KEY` | TTS |
| `ELEVENLABS_API_KEY` | TTS fallback and transcription |

**Not in the repo, required to operate a new project**

- Database password, pooler string, and service-role key of the new project.
- Google OAuth client id and secret.
- A sending domain and mail provider the company controls, if mail leaves Lovable.
- Twilio credentials the company owns, if SMS stays.
- Deepgram and ElevenLabs keys (re-issue; do not assume the current host will keep serving them).
- Inbound email provider credentials.
- The visible custom Secrets list contains `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, and `LOVABLE_API_KEY`. Project connections displays “No connections yet.” These screens do not establish whether platform-injected or connector-managed variables exist elsewhere; SMS runtime configuration remains unverified.

`SECURITY.md` says secrets live in Lovable Cloud secret storage. That matches the code: service-role and provider keys are not committed. The publishable client key is committed in `.env`. Use the destination project’s public key when the project changes; a publishable key is not a service-role secret.

### 9. Lovable-specific dependencies

| Item | Branch | Evidence |
| --- | --- | --- |
| `lovable-tagger` | **Both** | `vite.config.ts` dev plugin; `package.json` devDependency `^1.1.13` on main. `develop` still builds with it. |
| `@lovable.dev/cloud-auth-js` | **Both** | Google sign-in |
| `npm:@lovable.dev/email-js` | **Both** | `process-email-queue` |
| `npm:@lovable.dev/webhooks-js` | **Both** | suppression webhook |
| `.lovable/plan.md` | **Both** | Editor plan for the pay-validation trigger. Not runtime. |
| AI gateway | **Both** | `https://ai.gateway.lovable.dev/v1/chat/completions` in five functions |
| Twilio connector | **Both** | `https://connector-gateway.lovable.dev/twilio` |
| Hardcoded hosts | **Both** | README live URL on main; `notify-talk-attendees` default `https://id-preview--be4f9bee-f0ea-4d93-8142-1b82027df08c.lovable.app`; preview-auth zones; `index.html` OG image on `storage.googleapis.com/gpt-engineer-file-uploads/...` |
| Hardcoded Supabase ref | **Production (main)** | `PhotosSection.tsx` and `PlansSection.tsx`. **Fixed on develop, not released** (see storage). |
| Build | **Both** | `componentTagger()` only when `mode === "development"`. Production `vite build` does not need the tagger at runtime, but the dependency must install unless removed. |

Weather (`api.open-meteo.com`), maps (Nominatim, OSM, Esri, OSRM, Google Maps links), Divvy, HCSS, Clearstory, and Exactix are ordinary outbound links and are not Lovable (**Both**).

### 10. Hosting

- **Both:** Vite + React SPA. Routes are client-side (`react-router-dom` `BrowserRouter`). The host must rewrite unknown paths to `index.html` or refresh on `/jobs/:id`, `/safety/take/:token`, and `/unsubscribe` 404s. `main` uses Vite 5; `develop` upgrades the toolchain in `package.json`. Either way the output is a static `dist/`.
- **Production (main):** no committed CI. **Fixed on develop, not released:** `.github/workflows/verify.yml` runs local checks only.
- `VITE_*` must exist in the host's build environment. Changing them requires a rebuild.
- PWA: `public/manifest.webmanifest`, `start_url: "/"`, icon `app-icon.png` (**Both**).
- **Live verified:** `app.schreiberexcavating.com` is Live and Primary; the Lovable hostname remains available. DNS provider/account ownership and record delegation remain unverified.
- `develop` local docs warn that `npm run dev` / `bun run dev` uses the existing `.env` and can point at production. Keep using that warning.

## Blockers

1. **Repo migrations are not a full schema (Both).** Replaying `supabase/migrations` on an empty database fails on HR triggers and does not create `email_queue_dispatch`, `email_queue_wake`, queue wake triggers, or any dashboard-only policy edits. `develop`'s `local/hr-bootstrap.sql` is a local reconstruction, not a released migration.
2. **Google sign-in is Lovable's wrapper (Both).** Password continuity needs a tested `auth.users` export that includes password hashes. Google identity continuity needs a test on the rehearsal project. Relinking is a contingency if that test fails.
3. **Email, AI, and SMS stop for different reasons (Both).** Email depends on the sending-domain configuration (delegation is a source comment; **NEEDS ACCESS to confirm** DNS) and the Lovable email API. AI depends on `LOVABLE_API_KEY` and `ai.gateway.lovable.dev`. SMS depends on the Lovable connector credentials and Twilio number. Cutting the email domain does not, by itself, describe the AI or SMS cutover.
4. **No independent staging project has been verified.** The local notes describe none, and nothing in `main` defines one. Synthetic staging can start before any Lovable transfer answer.
5. **`main` is live.** Lovable syncs `main` both ways. This audit branch targets `develop` and must not be merged to `main`.
6. **Seeded shared password is in git history (Both).** Rotation is required even if hosting does not change. Do not copy that migration into the new project.
7. **Absolute `talk-media` URLs (Both).** `toolbox_talks.image_url` keeps the old project host until rewritten. **Production (main)** also hardcodes that host in `PhotosSection.tsx` and `PlansSection.tsx`. **Fixed on develop, not released.**

## Access and export checklist

Read-only access has resolved the basic counts and several settings. The next step is obtaining and restore-testing portable exports, not repeating the same dashboard inventory. Keep all Auth and employee data in an access-controlled private store, never this repository.

| Still needed | Purpose |
| --- | --- |
| Full schema-only export and separate sanitized scheduler configuration | Include tables, types, views, constraints, policies, grants/default privileges, auth/queue triggers, dispatch/wake functions, publication, extensions and Vault **names only**. Schema-only dumps do not include `cron.job` configuration rows. Review definitions for embedded credentials before sharing. |
| Private database export, documented contents and tested restore | Confirm compatible Auth users/password hashes and identities, business data and operational state. Built-in export UI exists, but completeness and restoreability are unverified. Exclude scheduler-history rows from destination import. |
| Separate storage contents and manifest with checksums | Metadata inventory is complete at this snapshot; file export and restore remain outstanding. |
| Remaining Auth configuration | Site URL, redirect allow-list, SMTP/send hook, templates, exact password policy, MFA enforcement/enrollment. Provider and user counts already verified. |
| Deployed function source and gateway settings; external schedules | Count is verified, deployed parity is not. Include inbound webhook authentication configuration. |
| Destination secrets provisioned through a secure channel | Visible custom names are recorded above; platform/connector runtime requirements still need confirmation. |
| DNS ownership for schreiberexcavating.com and schrex.com; sender-domain delegation | Primary app host and sender name are known; DNS account/control is not. |
| SWPPP inbound provider, mailbox and forwarding/webhook configuration | Recreate delivery and cover every writer during cutover. |
| Optional project-transfer answer from Lovable support | Plan for company-owned Supabase and a fresh project; do not block synthetic staging or exports on a possible transfer. No transfer route has been verified here. |

The 2026-10-16 file on `develop` (`local/reference/schema_benefits_positions_timeoff.sql`, SHA-256 `30baff2ad62f1a9f4bb69d71c56b3d851db92d3a2439c798b0345120aba6ce8a`) is a partial catalog extract, not this dump. It is not a backup.

## (a) Two environments, not one staging database

### Ordinary staging — synthetic only

Shared by developers and branch previews. No production employee rows, no production Auth users, no SSN, no pay rates.

1. **New Supabase project** in the company's own org, Postgres 17, region chosen explicitly. Empty. Do not link the Lovable CLI at this repo. Start this without waiting for a transfer decision.
2. **Schema:** prefer a schema-only dump of production. If the dump is delayed, load migrations with a reviewed HR bootstrap and the `positions.is_salaried` prerequisite used by `scripts/prepare-local.mjs` inserted before `20260421010923`; skip `20260419193344` and the local-incompatible realtime ownership change. Diff that result against the dump before trusting it. The bootstrap on `develop` is the local reference, not a license to run it on production.
3. **Host:** Vercel, Netlify, or Cloudflare Pages. Bun 1.3.14 with `bun install --frozen-lockfile` and `bun run build` (Node-based tools use `.nvmrc`), `dist` as the output, SPA fallback to `index.html`, and build-time `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` for this staging project. Previews use this project or another disposable synthetic project, never production and never the rehearsal project below.
4. **Seed:** synthetic users only. `develop`'s `local/seed.sql` is a starting point and still needs a review so it cannot target production.
5. **Google:** a separate OAuth client named for staging, with the staging hostname and `http://localhost:8080` only.
6. **Integrations:** stub or disable AI, SMS, inbound mail, and outbound mail. Use a sink. Do not put production `LOVABLE_API_KEY` into staging.
7. **Auth policy:** disable public signup on this project. Create users through an admin path. The button in the repo is not the control.
8. **`develop` tooling** (`bun run dev:local`, disposable Docker) can stay as a laptop/CI check. It is not this staging project. Its notes say Edge Functions and Realtime are off.

Build staging frontends from `develop` (or a branch off it), where plan/photo uploads already use `VITE_SUPABASE_URL`. A build of `main` still hardcodes the production Supabase host in those two screens.

### Migration rehearsal — real data, locked down

A separate Supabase project and host. Not the shared staging project. Not a laptop.

- Access limited to the people running the copy. No branch previews, no shared CI logs, no Lovable editor connected.
- Real employee and Auth data may be loaded here for the dry run only.
- Outbound email, SMS, AI, and all schedules (pg_cron and any external cron) disabled before the load. A celebrations job or a truck-request email against copied rows would notify real people.
- Same RLS and column grants as production.
- Wiping the project afterward removes the database copy. It does not undo exposure that already happened through previews, build logs, function logs, error trackers, or an integration that was left enabled. Treat the rehearsal as a place where production data was present, and keep its logs as restricted as the database.

## (b) Phased migration and recovery

Keep the primary domain and https://schreiber-hub-central.lovable.app on the current Supabase project until the new host has passed the checks below. Cutover is not justified until Phase 0 exports exist and the rehearsal has been done.

### Phase 0 — Inventory

Finish and restore-test the outstanding exports above. Revalidate the recorded live snapshot immediately before cutover. Ask Lovable about non-automated options in parallel. Do not block Phase 1's synthetic project on that answer.

### Phase 1 — Schema parity on synthetic staging

Apply the schema-only dump to the synthetic staging project. Compare, at least:

- table and column names against `types.ts` (expect 60 tables)
- enums, views (`positions_public`, `employee_contacts_directory`)
- functions, including `email_queue_dispatch`, `email_queue_wake`, `handle_new_user`, `has_role`, `get_employee_contact_sensitive`, `list_employee_directory`
- triggers on the three HR tables, `auth.users`, and both email queues; account for the duplicate compensation-validation triggers
- RLS flags and full policy definitions (roles, commands, USING and WITH CHECK), table/column grants and default privileges
- publication tables, including whatever the live dump says about `toolbox_talk_attendees`
- storage buckets and policies
- extensions `pg_cron`, `pg_net`, `pgmq`, `supabase_vault`

Do not promote `local/candidate-migrations/20261016210000_time_off_request_permissions.sql` in the same change as the move. It is a behavior fix and needs its own review.

### Phase 2 — Synthetic rehearsal

Deploy the SPA to the synthetic staging host. Exercise synthetic data only:

- email/password sign-in, admin-created user, profile and `employee` role trigger, and a signup attempt that the project rejects
- Google sign-in on the staging hostname with the staging OAuth client
- one private upload and a signed URL (plans or handbook), confirming the request host is the staging project
- one public `talk-media` image URL rewritten to the staging project
- realtime on notifications and truck requests
- time-off create and admin approve
- a queued email that lands in a sink, including unsubscribe
- a celebrations run with schedules pointed at the sink, or with the job invoked once by hand
- SMS and AI either stubbed or called with non-production keys

### Phase 3 — Production-data rehearsal (restricted project)

Run this only in the migration-rehearsal project, with outbound email, SMS, AI, and schedules disabled.

Prefer a full copy for this inventory, excluding old scheduler-history rows; measure export, transfer, restore and verification time. Use incremental tooling only if the measured downtime requires it. Specify the copy method and practice it. A filter on `updated_at` captures inserts and updates and misses deletions. The rehearsed method must do one of the following:

- **Full copy during a practice freeze** of `public` data, `auth.users` / `auth.identities`, and storage objects, then a second full copy to prove it is repeatable.
- **Delete-aware incremental copy:** primary-key diff plus content checksums for rows, plus a storage inventory diff that includes removed objects. Practice a known delete, a known update, and a known insert, and show all three land correctly.

Also practice:

- Sign-in as a copied password user.
- Record which `auth.identities.provider` values exist. That test decides whether Google continuity works. Relink stays a contingency.
- Rewrite stored absolute URLs (`toolbox_talks.image_url`, and any `video_url` that points at the old project).
- Compare row counts, a deletion sample, and a few checksums.

Then remove the data from the rehearsal project under the access rules above. Remember that a wipe does not recall logs or preview exposure.

Do not load that dump into a laptop database. Payroll, SSN, and bank fields are in it.

### Phase 4 — Cutover

This phase requires separate explicit production authorization; updating this report does not authorize execution.

1. Pick a low-traffic window. Tell the crew the app will reject writes for the copy.
2. Snapshot the Lovable project (a restore-tested database backup plus actual storage file contents and a checksummed inventory). Keep that backup as the start of the retention archive.
3. **Write freeze on the old system, before the final copy.** A maintenance page on the new host does not stop writers who can still open `*.lovable.app`. Freeze every path that can change old data:
   - The Lovable-hosted app: maintenance mode or an equivalent that rejects sign-in and writes on `schreiber-hub-central.lovable.app` and any custom domain still pointed there.
   - Direct Supabase access: confirm no other client (script, Lovable editor session, personal `npm run dev` pointed at production) is using the anon or service key.
   - Schedules: unschedule `process-email-queue`, `daily-celebrations`, and any other `cron.job` or Lovable schedule found in Phase 0. Prevent queue wake triggers/enqueue paths from re-arming email cron or invoking the worker; verify no jobs remain active.
   - Edge functions that write: disable or return a maintenance response for `inbound-swpppp-email`, `create-employee`, `convert-employee-contact`, notification senders, and the email worker. `verify_jwt` alone is not a freeze if webhooks are authorized.
   - Inbound webhooks at the source: pause the SWPPP inbound provider so it stops POSTing, and pause the Lovable suppression webhook if it writes `suppressed_emails`.
   - Auth admin actions: no invites, password resets, or user deletes during the freeze except the operator's own break-glass account.
   - Check `email_send_log` / queue depth and storage listings once, wait, and check again. Stable samples are supporting evidence only: enforce write rejection for existing sessions, direct API clients, Auth changes, functions, schedules and webhooks, and verify those controls; samples cannot prove absence of updates or deletes.
4. **Final copy during that freeze.** Use the method rehearsed in Phase 3. If the delete-aware incremental procedure was not rehearsed successfully, do a full copy (database, auth, storage) while writers are stopped. Do not describe an unrehearsed "rows changed since the dry run" pass as the cutover copy.
5. Deploy functions to the new project with the new secrets. Leave schedules off until post-cutover checks pass. Set `verify_jwt = false` only on the functions that must be public (unsubscribe, suppression, preview, inbound SWPPP, and celebrations if it uses a cron secret), and require the shared secrets those functions already check.
6. Point the new host's production env at the new Supabase project and deploy. Confirm plan/photo uploads use `VITE_SUPABASE_URL` (the `develop` behavior), not the hardcoded production host from `main`.
7. Change DNS for the chosen app hostname. Lower TTL the day before. Leave the old Lovable URL frozen, not deleted, so rollback can reopen it.
8. Add the production Google redirect URI before the DNS switch.

### Rollback is a data recovery, not a DNS flip

Set a **rollback decision point** before cutover: a named person, a clock time, and the checks that force a rollback. The operational window for that decision is separate from payroll retention (see below). One work week is a reasonable operational window to decide. It is not a retention period.

Pointing DNS back at Lovable, by itself, drops every write made on the new system out of the app users are looking at. Those writes still exist only on the new project until someone copies them back.

When the decision point says rollback:

1. **Stop writes on the new system.** Same coverage as the freeze: new hostname, new Supabase client keys, new cron, new edge functions, new inbound webhooks, and Auth admin changes. Enforce and verify the same write controls; repeated samples alone do not prove a freeze.
2. **Reconcile everything written after cutover** back onto the old project, using the rehearsed delete-aware method or a full diff since the cutover snapshot:
   - inserts, updates, and deletes in `public`
   - Auth changes: new users, password resets, email changes, banned/disabled flags, and identity links
   - storage uploads and storage deletions
   - notifications already sent (email, SMS, in-app). Record them. Delivery cannot be undone. Tell affected people if a message from the new system must be ignored or followed by a correction.
3. **Verify** on the old project: row counts, a sample of updates, a sample of deletes, Auth user samples, and storage checksums against the new project as of the new-system freeze.
4. **Reopen the old system.** Restore the old schedules only after verification. Point DNS back, and lift the Lovable maintenance mode, only after that verification. Users then see the reconciled data.
5. Keep the new project read-only until the reconciliation is accepted, so a second diff is still possible.

### Retention

New York payroll-record rules require keeping applicable records in a recoverable archive for six years. The Department of Labor's recordkeeping summary is [CR 142](https://forms.labor.ny.gov/WP/CR142.pdf). That obligation is an archive (backups the company can restore, with access control), not a requirement to leave Lovable running. `SECURITY.md` states the same six-year period for payroll-related records and says not to delete `pay_audit_log`.

The one-week operational rollback window is a separate decision about how long the frozen Lovable project stays ready to reopen. After that window, decommission the running Lovable app only if the archive has been tested (restore a backup to a locked project and read a pay row and an audit row). Keep the archive for the statutory period.

### Phase 5 — Post-cutover checks

- Password sign-in, and a Google sign-in that either continues the copied identity or follows the rehearsed relink contingency.
- A foreman sees only their own pay row; an admin sees `pay_audit_log`; another employee cannot read it.
- Schedule, jobs, a signed file download whose host is the new project, a truck request, a time-off request, a notification arriving over realtime.
- Outbound mail from the company-controlled domain, unsubscribe, and one inbound SWPPP test message.
- Celebrations job ran once, on purpose, after schedules were re-enabled.
- AI and SMS each either work on their own new credentials or are visibly disabled. They are not implied by email working.
- The old Lovable URL stays frozen and restorable until the rollback decision point passes.
- Error logs and auth failure rate for the first day.

## Risks to plan around

- **Password hashes** move only with a compatible `auth.users` copy. A CSV of emails is not enough.
- **Google identities** need a rehearsal test. Relinking is the fallback if the copied identities do not sign in against the company-owned OAuth client.
- **Signup UI (Both)** calls `signUp`, and the trigger assigns `employee`. **Live verified:** public signup is enabled. Disable public signup on every new project before it has a public hostname.
- **Shared password in git history (Both)** remains after rotation. Rotation still matters because those hashes were generated from a password anyone with the repo can read.
- **Storage URLs** in `image_url` (**Both**) break when the project ref changes. Private `file_path` values survive a same-path copy. Deletions survive only if the copy method records them.
- **Hardcoded project URL** is **Production (main)** in `PhotosSection.tsx` and `PlansSection.tsx`. **Fixed on develop, not released.** Shipping `main` unchanged would keep those uploads on Lovable's project.
- **Email domain** in source comments is unverified until DNS is read. AI and SMS fail on their own credentials even if that domain stays put.
- **Dual write** if the Lovable URL stays open during the freeze, or if cron and SWPPP keep writing. The freeze list in Phase 4 is the control.
- **Schema drift will grow** if Lovable keeps editing `main` during staging. Re-diff migrations and types immediately before cutover.
- **`develop` is not production.** It has the upload-URL fix, local HR SQL, and CI. Merging it to `main` would ship that branch through Lovable. It is an input to synthetic staging, not a release.
- **Rehearsal exposure** survives a later wipe if logs, previews, or integrations saw production rows.
