# Migration readiness — 2026-10-20

**Current release checklist:** [migration completion plan](migration-completion-plan.md).
The detailed report below retains historical evidence, not current task ordering.
Auth SMTP/code recovery is user-confirmed; app mail remains inactive, fresh queues
exist, service RPC grants and function deployment are pending. No production cutover.


**Current launch plan (2026-10-20):** see [launch scope](migration-launch-scope.md).
Use the verified restored baseline: the user reports no source use/changes for
three months. No automatic repeat export/import or change capture. Six essential
workflows are prioritized; AI/SMS/speech/celebrations are deferred. Older snapshot
and all-feature gates below are historical. The approved rehearsal-only admin grant
also supersedes earlier employee-only descriptions. Full app cutover remains pending.

Subsequent hosted employee acceptance: one job photo rendered from a signed
rehearsal Storage URL and its browser download matched the archived size/SHA256.
A job-plan PDF tab opened on the rehearsal host (not a complete PDF byte check).
The actual database role is employee-only; admin route redirects home and direct
sensitive-column HEAD read returns HTTP 403. Cross-user compensation query exposes
zero records, with the known-existing-record caveat. Hosted foreman/admin sessions,
cross-user Storage denial and mutation acceptance remain pending.

Latest update: controlled hosted acceptance has begun since the parallel review below.
The agent has now directly observed the signed-in profile, seven job-list entries
and one populated job detail through the ordinary rehearsal browser session.
That job has no plans/photos listed, so file-download acceptance is still pending.
No application writes or role changes were performed. Fresh required local
verification groups pass; the separately documented two Storage HTTP failures remain.
The separate loopback rehearsal frontend is implemented; the user reports successful
password recovery, login and profile-name loading. Email/password and Data API are
enabled, with public already exposed. Signup stays off; email blocker and workers
were not changed. User identifies Zachary Schreiber as existing admin; no roles
changed. Full hosted browser/role/file acceptance and production cutover remain
pending. Earlier "keep login/Data API off" instructions below belong to the prior
review phase. See DEVELOPMENT_PROGRESS.md for the chronological activation record.

Status: partial independent restore; not ready for production cutover. This report
separates prior hosted evidence from today's synthetic testing. Source production
was not modified, and real-data rehearsal remains isolated. No new hosted activation
was performed during this parallel review.

| Category | Evidence already established | Remaining acceptance gate |
| --- | --- | --- |
| Business and Auth data | 62 COPY sections independently matched the archived snapshot, including password hashes | Final snapshot consistency, remaining managed Auth state classification and post-test reconciliation |
| File preservation | 23 files byte/size/ownership/content metadata verified; 15 private buckets | Hosted ordinary-user file API tests, reference/URL adaptation, cross-user denial |
| Database behavior | 70 reviewed business triggers active and verified; deliberate candidate fixes installed | Complete hosted workflows and authorization checks with those behaviors combined |
| Access controls | Reviewed table/column/function grants and 57 authenticated Storage policies verified; 600 synthetic metadata policy checks | Hosted ordinary-client RLS/Storage tests; no service-role-only acceptance |
| New-user setup | Synthetic trigger integration passed; see below | Managed Auth trigger installation and independent verification; actual owner login, sessions, providers/MFA |
| Application and media | Local static/unit/build status recorded below | Isolated frontend configuration, private media URLs, hosted browser/network checks |
| Email and external services | Separate email-test project has verified domain and one Postmark Delivered recovery message | Inbox/reset flow, rehearsal SMTP, app notification worker, SMS/AI/speech and inbound webhook decisions/tests |
| Realtime and scheduler | Source publication baseline documented; rehearsal outbound scheduling absent | Authorized subscriptions/denials; reviewed scheduler/queue reconstruction, empty destination execution history proof |
| Cutover and recovery | Original exports retained privately; source remains untouched | Repeat restore timing, fresh coordinated database/files snapshot, freeze/reconciliation/rollback rehearsal and explicit release approval |

## New-user integration tests

`scripts/local-auth-restore-check.py` passes six source function/security checks and
six related business trigger bindings. Local postgres creates the managed Auth
trigger; supabase_auth_admin inserts exercise six complete new-user variants.
Employee-only role assignment, contact linkage and display/full-name/email fallback
are checked. Exact duplicate-email rejection and forced downstream failure both leave
no partial user/profile/contact setup. Rollback restores functions, ACLs and triggers.

Source behaviors are preserved: blank display name remains blank; contact/profile
names can differ; multiple matching unlinked contacts choose the oldest case-insensitive
match; already-linked contacts are not reused. These are not resolved by this test.
No hosted Auth trigger was installed. Passwords, sessions, provider login, HTTP Auth,
email and concurrent signup still need separate proof.

## Media compatibility finding

`src/pages/Safety.tsx` renders stored image/video URLs directly. The toolbox-talk
Edge Function creates public talk-media URLs, while rehearsal intentionally keeps
that bucket private. Reference migration and authenticated/signed media access need
implementation and end-to-end tests. Policy verification alone cannot prove rendering.

## Interpretation

Missing scheduler extensions are an isolation measure, not evidence that the scheduler
has been restored with empty history. Preserve source execution history; only destination
execution history should start empty. Synthetic fixtures stay in local Docker; do not
run routine synthetic suites against the real-data rehearsal. Keep login, Data API,
Email and workers off until the controlled hosted acceptance plan is ready.

## Current-checkout verification

Pinned Bun 1.3.14 / Node 26.8.2 were used:

| Command | Result | Scope |
| --- | --- | --- |
| `bun run verify:app` | PASS | TypeScript, 19 tests across three files, local-configured build |
| `bun run verify:lint` | PASS with 30 warnings | Zero errors; warnings remain |
| `bun run verify:edge` | PASS | 15 configured entry points and their imports, not every deployed function |

The initial Edge dependency lookup failed in the restricted sandbox; the approved
retry passed. Build warns about an old Browserslist dataset and large bundle.
No production application was launched.

### Documentation versus implemented code

AI/SMS/speech preparation docs describe helpers/tests not present in this checkout
(`ai-json-chat`, `sms-transport`, `speech-transport` and associated tests). Other docs
mention absent `local-auth-storage` and `local-email-delivery-guard` scripts/commands.
Locate the relevant branch/commits and review integration before counting those claims.
The current queue worker still imports Lovable email transport, and Google login still
uses the Lovable broker. The Edge check does not certify all email/Auth endpoints.

## Actual local Storage HTTP acceptance

`scripts/local-storage-api-acceptance.mjs`: **558/560 cases passed; two failures**.
Four operations across five roles, own/other paths and all 14 local private buckets
were exercised through the Storage HTTP API. Anonymous access was denied. Denied
mutations preserve original bytes. The test exits 2 while the two gaps remain.

- Office replacing another user's accident photo: HTTP 403/RLS rejection.
- Admin replacing another user's accident photo: HTTP 403/RLS rejection.

Same-role replacements under their own path pass, so these are permission-specific
failures, not a general transport outage. SQL UPDATE-policy tests alone did not reveal
the Storage API result. Do not change policy to widen access without reviewing the
intended operation. All tracked objects and temporary users/contacts were cleaned up;
existing policies and bucket flags remain unchanged.

Talk-media is deliberately omitted from this HTTP matrix: local source configuration
is public, while the reviewed hosted target is private. Its private HTTP behavior and
media rendering still need their own test. None of these HTTP tests targeted the
real-data rehearsal.

## Recommended execution order

1. Resolve the accident-photo replacement expectation and private talk-media path;
   verify the missing integration work against actual branch/commit contents.
2. Prepare/install reviewed managed Auth new-user setup while isolation remains intact.
3. Prepare controlled hosted acceptance using owner-authorized accounts and ordinary
   client tokens: login, role boundaries, signed file reads and reference resolution.
4. Validate Realtime and independent external integrations in synthetic/sink environments;
   restore reviewed scheduler/queues with destination execution history empty.
5. Rehearse final coordinated snapshot, cutover and rollback, then request explicit
   production release authorization. No switch to production is implied by this report.
