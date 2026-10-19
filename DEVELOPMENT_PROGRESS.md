# Development progress

Updated: 2026-10-19. This is the current status record; update it after each meaningful
verification or change. A successful local check never marks a production step done.

## Review packaging and current scope — 2026-10-19

DNS verification and the full database export remain blocked on access. The accepted
email plan is Supabase Auth SMTP through Postmark and the existing notification
queue. New delivery-tracking infrastructure is paused; the standalone adapter and
additional safeguards below are optional review work, not prerequisites for DNS
verification or a rehearsal password-reset test. No provider switch is enabled.

Migration documentation/private-inspection tooling is being packaged in draft PR
#10; runtime integration changes are isolated in a separate draft targeting develop.
Historical entries below describe that companion work, not code included in the
audit PR. A separate job Files feature starts from develop and uses synthetic data.
Neither review authorizes merging to main or deploying. Full independent restore
remains unproven; preserve business records/Auth/files and exclude destination
scheduler execution history while leaving the source untouched.

## Suppression and retry safeguards — 2026-10-19

Added delivery-time suppression checks to the worker: transactional mail checks
current suppression and used unsubscribe tokens; Auth ignores marketing unsubscribe
but honors bounce/complaint/unknown suppression. Lookup failures defer without
provider attempts or retry-budget increments. Initial cooldown state, prior-sent
and failed-counter lookup failures stop processing. HTTP429 now uses schema-supported
`pending` plus metadata instead of unsupported `rate_limited`; log/cooldown write
failures stop the batch. No deployment or provider switch.

Postmark standalone adapter now exposes explicit `deliver()` outcomes, intentionally
incompatible with the worker's void-send interface. Ambiguous timeout, malformed
success and server responses require reconciliation, never ordinary retry. Known
suppression/configuration/permanent rejection and rate limits remain distinct.
No durable hold is claimed: actual claim/receipt persistence and concurrency control
still require implementation before activation. Current queue RPC timestamp and
enqueue idempotency gaps are recorded in [safeguards](docs/migration-email-safeguards.md).

Validation: 174 normal-suite tests, app typecheck/build, lint (30 existing warnings),
all 18 Edge entry points and explicit Postmark module Deno check pass. New guarded
local DB test passes 24 suppression/token/queue combinations, actual REST error
deferral and schema-valid rate-limit logs without consuming retries. Fixtures cleaned,
no reset or queue/provider calls. Added this test to backend verification and verified
the package command. [Local validation](docs/migration-email-local-validation.md)
distinguishes helper/DB checks from served-worker or concurrency proof. Existing
browser/full backend suites not rerun; no UI/schema change. DNS remains pending;
Postmark stays disconnected, production unchanged, real-data import paused.

## Postmark account inspection and adapter — 2026-10-19

User provided a signed-in Postmark tab. Read-only inspection confirms Owner access,
existing `hub-rehearsal` server 21137606, default outbound/broadcast/inbound streams,
SMTP enabled and open/link tracking disabled. Account test mode is not a proven
non-delivering Sandbox server; inspected UI did not establish server delivery type.
User subsequently completed account-email confirmation; refreshed dashboard no
longer shows that banner, but account test mode remains. Both `mail.schrex.com` and
`schrex.com` show unverified DKIM/Return-Path. Recorded exact public DNS values for
the subdomain and planned Auth SMTP fields in [Postmark setup](docs/migration-postmark-setup.md).
DNS access remains pending; no records, settings, tokens or account approval changed.

Prepared standalone Postmark API adapter and 11 fake-request tests. Explicit stream,
content, unsubscribe headers and provider receipt mapping; raw errors sanitized,
HTTP/API codes separated, no automatic retries or assumed idempotency. Worker remains
on Lovable. Activation requires suppression/permanent-error handling, provider receipt
persistence and duplicate-send reconciliation, plus distinct Postmark webhook auth.
See [adapter report](docs/migration-postmark-adapter.md).

Combined app checks pass: TypeScript, 132 tests and build; lint 0 errors/30 existing
warnings. Standalone adapter Deno check passes. No network email tests, credentials
read/generated, live sends, DNS edits, paid upgrades, deployment or production changes.
No browser/backend rerun needed for the unconnected adapter. Export/import remains paused.

## Track 2 email, SMS and speech preparation — 2026-10-19

Continued with three agents on existing feature branch. Added 11 unsubscribe token
compatibility tests, 12 SMS fake-fetch tests, and 21 speech tests. SMS transport now
rejects success without a message ID and stores sanitized failure codes. Speech
retains Deepgram/ElevenLabs paths and fallback, with sanitized errors and transcript
type checking. Removed raw unsubscribe token logging. Existing providers remain
unchanged; no live delivery or deployment. Combined 121 tests/build pass; a speech
TypeScript narrowing issue was fixed and final typecheck passes. Lint passes with
30 existing warnings. All 18 Edge entry points pass; suppression/unsubscribe now
included. Browser/backend suites not rerun for these transport-only changes.

Rechecked authenticated Lovable domain UI on user request: sending domain
`notify.www.schrex.com` Verified. Public DNS confirms Lovable NS delegation and
Mailgun SPF/MX; `schrex.com` uses domaincontrol nameservers, while
`schreiberexcavating.com` uses Wix nameservers. User reports Outlook company email
and GoDaddy OTPs. Account ownership/access and independent provider selection
remain pending. [Provider setup](docs/migration-provider-setup.md) records details.
No OTP used, DNS changed, credentials read, production modified or paid service
provisioned. Real-data export/import stays paused.

Remaining mail gates include delivery-time suppression recheck, non-atomic
unsubscribe writes, provider-specific webhook verification and independent Auth
mail configuration. [SMS](docs/migration-sms-preparation.md) and
[speech](docs/migration-speech-preparation.md) reports distinguish stub tests from
real delivery/hosted authorization proof.

## Login helper and integration implementation — 2026-10-19

Continued user-authorized steps 1–3 without importing real data or changing hosted
settings. Existing feature branch and prior dirty changes preserved.

- Private login: `scripts/rehearsal-login-check.sh` fixes the rehearsal target,
  uses verified TLS and the existing PostgreSQL 17.11 container client, prompts
  privately and runs one read-only identity/version query. Syntax, noninteractive
  refusal, client and CA mount checked. User-supplied terminal screenshot confirms
  successful operator login/query: database/role `postgres`, version 17.11,
  `read_only=on`, completed ROLLBACK without visible errors. No password disclosed.
  See [connection readiness](docs/migration-connection-readiness.md).
- Email: extracted existing expiry/retry/error policy into a helper used by the
  worker; 20 new regression cases pass, preserving current behavior. Lovable remains
  the default. Full queue effects and independent delivery remain untested.
- Google: opt-in Supabase OAuth path with local-mode guard, default Lovable path,
  failure handling and 12 mocked helper/UI cases. No hosted provider enabled.
  [Google preparation](docs/migration-google-preparation.md) records setup gates.
- AI: provider-neutral JSON chat helper used by `suggest-safety-topic`; existing
  endpoint/model retained. Seventeen fake-fetch cases cover request/error/malformed
  responses. Invalid payloads are now rejected and provider error bodies are not
  logged. [AI preparation](docs/migration-ai-preparation.md) records limits.

Combined app typecheck/build passed, and final normal Vitest suite passes 77 tests.
Edge static checks pass all 16 entry points; existing synthetic browser test passes
1/1. Lint passes with 30 existing warnings. Browser/Edge tooling needed network
escalation after sandbox registry access failed; approved retries passed.
Company-owned provider account inventory is awaiting user input. SMS and speech
remain in scope but have not been replaced. No real provider calls, deployments,
paid provisioning, production edits, merge/push or export/import occurred.

## Four parallel follow-up workstreams — 2026-10-19

User authorized email preparation, synthetic testing, connection preparation and
launch-feature planning in parallel. Three agents handled implementation/tests/scope;
primary agent inspected connection details and integrated the results on the existing
feature branch. All existing dirty work was preserved; changes remain uncommitted.

- [Email preparation](docs/migration-email-preparation.md): provider-neutral delivery
  interface and test-only `.test` sink; queue worker still uses Lovable by default.
  Nine new synthetic cases pass. Queue client typing corrected for static checking.
  No replacement provider or actual delivery has been tested.
- [Synthetic validation](docs/migration-synthetic-validation.md): signup, linked
  profile/contact, forged-role rejection, login UUID continuity and private-file
  access/denials pass on existing disposable Docker. Added the new test to the
  backend verification group. No reset; unique fixtures cleaned up.
- [Connection readiness](docs/migration-connection-readiness.md): dashboard confirms
  free session-pooler route. Downloaded public CA; OpenSSL verifies TLS 1.3 chain and
  hostname. Direct DNS resolution failed; Python strict CA validation rejects a
  missing key-usage extension. No verification bypass. User has password privately;
  no authenticated SQL connection attempted. Host psql not found in checked locations.
- [Launch scope](docs/migration-launch-scope.md): retain existing capabilities in
  preparation scope; no deferral approved. Independent provider/account access and
  actual feature readiness remain pending; no paid service selected.

Validation: app typecheck/build and 28 unit tests passed; original backend group
4/4 and browser 1/1 passed; new Auth/storage script passed, including via its newly
wired package command. Lint passes with 30 existing warnings. Edge group and explicit
queue-worker static check passed; worker now included in the routine Edge list.
No hosted writes, import, secrets in git, production changes, merge/push, or Lovable
cancellation. Database download/import remains paused. Real-data recovery remains
unproved; synthetic testing is not hosted parity.

## Parallel migration preparation — 2026-10-19

Three user-requested agents prepared offline archive inspection, integration mapping,
and restore acceptance checks while the primary agent inspected the destination.
Database export download/import remains paused at the user's request because the
download link is unavailable. Work remains on `codex/migration-audit-live-findings`.

- [Destination audit](docs/migration-destination-audit.md): verified PG 17.11,
  one organization Owner, no Auth hooks, custom SMTP off, localhost site URL,
  no redirect URLs, and pg_cron/pgmq/pg_net disabled. Default Auth mail is not
  proven disabled. No settings changed; signup remains enabled for synthetic use.
- [Inspection tooling](docs/migration-restore-tooling.md): offline SHA-256 and
  format-candidate inspection with private-file/repository guards. Ten synthetic
  tests pass. This is not a restore executor or completeness validator.
- [Integration map](docs/migration-integration-map.md): provider dependencies,
  replacement work, required owners/access and planned synthetic checks. No
  provider calls or replacement integrations were implemented.
- [Acceptance checks](docs/migration-acceptance-checks.md): preservation and
  comparison plan plus two manual read-only SQL aids. Static guards pass; SQL
  syntax/database execution remain unverified. Destination scheduler history must
  start empty while source history, business audit and queue state are preserved.

Agent validation: focused Vitest 10/10; lint 0 errors with existing 30 warnings;
documentation links and whitespace checked. No production changes, import, paid
provisioning, merge, push or Lovable cancellation. Independent restore proof remains
blocked on the complete database/Auth export, secure destination connection,
compatibility review and effective side-effect isolation before real-data loading.

## Rehearsal destination inspected — 2026-10-19

User supplied project `acgqjjbrnkmeazswdnzp`; authenticated dashboard access verified.
Project name `hub-rehearsal`, organization Schreiber Excavating, Free plan, healthy
Nano compute in us-east-2 (Ohio). UI shows no public tables/views, no storage
buckets, no deployed Edge Functions, no migrations and no backups. Auth user list
shows no users, but its estimated footer was inconsistent; exact counts remain
unverified. Public signup is enabled; anonymous sign-in is disabled, email
confirmation enabled, Email provider enabled and Google disabled. No settings
were changed and no data imported. Destination isolation, scheduler/extensions,
mail/hooks and secure restore connection still need verification/configuration.
Supabase's default branch label main/PRODUCTION is internal to this rehearsal
project; it is not the Git production branch and no repository is connected.

## Storage archive captured — 2026-10-19

Downloaded all 23 application storage objects from seven populated buckets via
Lovable's Storage UI; checked the other eight buckets and confirmed they are empty.
Ten original ZIPs, reconstructed bucket/object paths, and a SHA-256 manifest are
stored privately under `/Users/sumanththota/Schrex/archive/storage-2026-10-19`.
All ZIP integrity checks pass. Downloaded bytes total 66,632,006, matching the earlier
aggregate inventory. Files and detailed object paths are outside git. No source
objects or bucket settings were changed. Current UI displays 5 GB global upload
limit (earlier audit recorded 2 GB); no limit change was performed by this agent.

ZIP downloads flatten parent paths, so the private manifest records observed source
prefixes and `objects/` reconstructs them. Hashes cover downloaded bytes; independent
server hashes, complete owner/content-type/cache-control metadata, and restore proof
remain pending. Capture occurred with live writers, not an atomic freeze. The private
`database_export_19_10_26` bucket was still empty when checked after file archiving;
database export completion/download remain pending. Synthetic staging is unchanged.
Documentation-only repository changes; `git diff --check` passes. Application test
suites were not rerun for this archive operation.

## Database export requested — 2026-10-19 14:33 UTC

User selected `/Users/sumanththota/Schrex/archive` as the temporary local archive.
Created the directory with mode 0700, owned by the local user, outside this repo.
User explicitly approved the intermediate Lovable Cloud storage and emailed
temporary download-link workflow. Clicked Start export; Lovable confirmed
“Database export started” and that it will email a download link when ready.
No archive downloaded yet; export completion, completeness, checksums and restore
remain unverified. Storage files still require separate downloads. Source records,
scheduler history, settings and running services were not changed by us; the
requested export creates a backup artifact. No paid provisioning or deployment.
The restricted independent restore destination is still unresolved.

## Migration preparation — current status (2026-10-19)

This entry supersedes older branch/merge status below; those entries are retained
as historical verification records. PR #7 and PR #8 are merged into develop
(`936bef8`). Remote main remains `5a81add`; local main remains `37284f0`.
Draft PR #10 targets develop, with head `528b424` on
`cursor/migration-audit-4b4b`. The clean local continuation branch
`codex/migration-audit-live-findings` matched that head before this documentation edit.
All five hosted checks pass at that head (run 39265809535); they do not prove recovery.

Read AGENTS.md, this record, local/README.md and the updated PR audit. Rechecked
Lovable access in the in-app browser: Cloud overview, Advanced settings and export
confirmation load. Canceled before Start export. No production settings/data were
changed, no export downloaded and no restore performed. No paid infrastructure,
merge, deployment or Lovable cancellation occurred.

The next milestone is private complete exports and an independent restore proof.
[Export/rehearsal preparation](docs/migration-export-rehearsal.md) records exact UI
steps, preservation/exclusion policy, verification criteria and access gates.
Private archive location/owner, protected transfer path, restricted execution host
and existing rehearsal target remain unidentified. Actual archive completeness,
Auth/hash compatibility and all file checksums remain unverified. Destination
scheduler history must start empty; source history and business/audit/delivery
state must be preserved. Synthetic staging stays separate from real-data rehearsal.

No application code or migrations changed in this preparation. Hosted checks were
inspected; local app/backend/lint/edge/browser suites were not rerun for docs only.

## Current milestone

Branch policy: `main` is production and must not receive commits, merges, or pushes
from ongoing development. Feature work targets `develop`; production release needs
an explicit user instruction.

Foundation work is saved on `codex/local-development-foundation`, based on
`5a81add`. Local `develop` remains at `5a81add`; local main remains at `37284f0`.
On 2026-10-18 the user requested local checkpoint commits and a return to clean
main. Existing lockfile changes are preserved separately in `772e995`; lint cleanup
is in `e6b454d`; this infrastructure checkpoint contains the remaining foundation.
Switch back to the feature branch before resuming foundation work. These checkpoints
are not release approval: that checkpoint had 53 lint errors / 30 warnings; the follow-up cleanup now has
zero errors / 30 warnings.
Those checkpoint commits did not change main. Subsequently, develop and all four
feature branches were published (see dependency publication entry below). GitHub
branch protection remains unconfigured. No merge or deployment has occurred.

Complete the local backend foundation and reconcile it with an authoritative Cloud
schema. Current status: **partial local proof; not ready for staging or release**.

| Work item | Status | Evidence / next action |
| --- | --- | --- |
| Repository/build baseline | Verified locally | Build + TypeScript pass; cleanup branch lint has 0 errors / 30 warnings |
| Isolated local Auth/database | Verified for limited scope | Synthetic accounts; API on 55321; `dev:local` |
| Time-off happy path and cross-user isolation | Verified locally | `bun run test:local`; prior manual browser submission |
| Targeted HR schema reconstruction | Verified locally; full parity pending | Supplied export incorporated; `local:audit-schema`: 60/60 tables and column names |
| Permission state transitions | Fixed and verified locally; NOT deployed | Forward migration `20261016210000`; permission + happy-path tests pass |
| External functions/Realtime | Not implemented locally | Explicitly disabled, not silently considered tested |
| Verification command and CI definition | Implemented and checked locally | First hosted app/backend checks pass; all three hosted groups pass at dbc66c1 |
| Branch protection | Not configured | Required remote checks await first GitHub run and lint cleanup |
| Staging | Not established | Separate backend and integration credentials needed |
| Production release | Not started | All seven release steps below remain pending |

## Foundation review — 2026-10-18

Reviewed local preparation/startup, verification workflow, permission migration,
API assertions, and release packaging. The fixed-loopback backend guard, synthetic
fixtures, unchanged historical migrations, exact authorization/constraint assertions,
and read-only CI permissions support continued isolated development. A fresh GitHub
runner successfully rebuilt the local database and passed the four backend checks.

Remaining review findings before integration/release:

- Resolved on the consolidation branch: the new time-off candidate now lives in
  local/candidate-migrations, outside normal production migration discovery.
  local:prepare copies this exact file only for disposable tests. Its eventual
  production promotion remains a separate explicitly authorized release.
- Local replay deliberately differs from production in four documented ways.
  The 60-table/column inventory does not validate full ACL/function/trigger parity.
- External functions and Realtime are disabled in the disposable backend. Static
  checks of edited functions do not establish live behavior or delivery success.
- CI is now running, but branch protection and staging/recovery are still absent.
  Draft dependency PRs include foundation changes and must not be treated as small,
  standalone production updates. Main was not changed in this review.

## Latest findings

- User supplied `schema_benefits_positions_timeoff.sql`, reporting a read-only catalog
  extraction at 2026-10-16 20:32:43 UTC and PostgreSQL 17.6. Original retained under
  `local/reference/`; SHA-256 recorded in `local/SCHEMA_RECONCILIATION.md`.
- Missing HR definitions restored through a local-only bootstrap before dependent
  migrations. The previous conditional trigger skips were removed. All 60 table
  names and column names now match client types; this is not complete live parity.
- HR API tests pass: admin writes, own-record reads, cross-user isolation, validation,
  generated compensation on insert/update, and audit records.
- Supplied time-off policies match the local defects. A new forward migration fixes
  pre-approved inserts and own cancellation, and prevents cancellation tampering.
  All local permission regressions and the admin-approval smoke test pass. Production
  has not been tested directly or changed; this migration still requires release review.
- Export has incomplete application-role grants and malformed generated-column syntax.
  Normalization and remaining parity limits are documented; no Cloud-only role was added.
- Existing plaintext shared-password account migration remains an audit finding;
  production credential validity has not been tested.

## Next actions, in order

1. Review the targeted reconstruction and forward permission migration. Obtain complete
   grants/default privileges and canonical generated-column metadata before declaring
   production parity; the current supplied export only lists `sandbox_exec` grants.
2. Review draft cleanup PR #7 alongside dependency PRs #4–#6. All three hosted
   verification groups pass at dbc66c1; 30 lint warnings and branch protection remain.
3. Expand safe integration and browser coverage; Edge Functions/Realtime remain disabled.
4. Establish staging, then rehearse deployment/backup/recovery before any live release.

## Production release checklist

- [ ] Candidate validated in staging.
- [ ] Release commit recorded and backup/recovery path verified.
- [ ] Backward-compatible database changes applied to production.
- [ ] Compatible backend functions deployed.
- [ ] Frontend published.
- [ ] Login and changed workflow verified in production.
- [ ] Production errors and service health reviewed.

## Change log

- 2026-10-18 browser automation: new codex/time-off-browser-test branch from develop
  merge 48ac1c9 (PR #7). Added pinned Playwright, isolated Chromium sessions and a
  time-off workflow test. Dedicated guarded frontend uses 8082; normal 8080 remains
  available. Each test cleans up only its unique synthetic request. CI adds a fifth
  browser job with a fresh disposable backend. Local workflow passed. Disabling the Approve action made the test fail at
  the pending-request assertion; restoring the app passed again. App/type/unit/build
  and lint checks pass (19 unit tests, zero lint errors, 30 warnings). All five hosted groups passed for 3c9866d in run 39165379937, including the
  browser workflow on a fresh Linux backend. PR #8 targets develop; not merged. Branch protection is unavailable
  on the private repository's current plan; the user selected manual PR/check review.
  No production changes or new integration merge occurred.

- 2026-10-18 combined local smoke test at aa6b03a: installed the exact frozen
  Bun lockfile in the actual checkout (Vite 6.4.4 / Vitest 5.0.5), started the
  disposable backend without reset, and launched guarded dev:local on 8080.
  Browser: employee login, Nov 9 synthetic vacation request submission (Pending),
  admin login and approval, other employee login with no visible requests, and
  original employee re-login showing Approved all passed. The single synthetic
  browser request was retained for inspection, labelled
  "Synthetic combined PR7 browser smoke 2026-10-18". Screenshot is temporary at
  /tmp/schreiber-combined-smoke-approved.png; the local tab remains open.
  Separate test:local and test:local:permissions passed, confirming cross-user
  reads/forged ownership are blocked, reversed dates rejected, self-approval and
  cancellation tampering rejected, and legitimate cancellation allowed. API test
  records were cleaned up by the scripts. No real employee data was used.
  Email delivery and Realtime remain untested. No branch protection changes,
  merge into develop/main, or production deployment occurred.

- 2026-10-18 consolidation: moved the unapplied time-off candidate out of
  supabase/migrations into local/candidate-migrations without changing its SQL.
  Local preparation still copies it explicitly into the disposable replay.
  Added verify:edge/typecheck:edge and a fourth CI group using Deno 2.5.6, checking
  the 15 edited entry points and imported modules without executing handlers.
  PR #7 is the combined development foundation; fully contained predecessors
  #4–#6 were closed with supersession links after verification. GitHub run
  39163074345 at 0e07a7e passed all four groups: app, fresh backend replay, lint,
  and Edge Function types. Local checks also passed and candidate SQL is unchanged.
  No merge or production deployment occurred. Predecessor branches remain retained.

- 2026-10-18 verification cleanup: isolated follow-up branch codex/verification-cleanup
  based on the Vitest replacement. Added codex/** push triggering; GitHub run
  39161662623 passed app and fresh-backend checks, while lint failed on its original
  53-error baseline. Earlier PR-trigger absence remains unexplained; Actions is enabled.
  Cleanup now passes local lint (0 errors / 30 warnings), frozen Bun install,
  TypeScript, 19 Vitest tests, build and four backend checks. Deno 2.5.6 static checks
  pass for all 15 edited Edge Function entry points. Scoped query/response contracts
  replace explicit any; these are not blanket runtime validation. Notification
  recipient extraction handles object and array profile embeds and has regression
  coverage. No services were invoked or deployed. Hosted cleanup validation passed at dbc66c1: run 39162075252 reports app, backend
  and lint success. This includes a fresh database replay on GitHub. Follow-up
  documentation commits do not change the tested code. PR #7 tracks this cleanup.


- 2026-10-18 dependency replacement publication: published develop at 5a81add and
  the foundation/source-map/brace/Vitest feature branches. Opened draft PRs
  [#4](https://github.com/Schrex/schreiber-hub-central/pull/4),
  [#5](https://github.com/Schrex/schreiber-hub-central/pull/5), and
  [#6](https://github.com/Schrex/schreiber-hub-central/pull/6), all targeting develop.
  These branches are cumulative: review foundation first, then source-map, brace,
  and Vitest. Their current full diffs include the unintegrated foundation and its
  forward permission migration; do not treat them as dependency-only release diffs.
  Linked and closed original npm PRs #1/#2/#3 as superseded. No production alert
  is considered resolved by closing those proposals. Remote main remains 5a81add;
  local main remains 37284f0. No merge or deployment occurred.
  Initial GitHub checks are absent, despite Actions being enabled; the reason has
  not been established. Hosted verification and lint cleanup remain required.

- 2026-10-18 remaining dependency validation: brace commit 2e7d88c updates the two
  locked lines to 1.1.21 and 2.1.7 without changing parent major requirements.
  Fresh frozen install, type checks, nine unit tests and build passed; parent
  resolution and ordinary expansion behavior passed for both versions.
  Vitest commit 557a7b3 upgrades Vitest to 5.0.5 and Vite to compatible 6.4.4;
  tinypool is absent from the resulting lock. Fresh frozen install, app checks
  and all four local backend checks passed. Synthetic employee browser login
  passed on an isolated Vite 6 server. Both branches retain 53 lint errors and
  30 warnings. Tests used temporary dependency installs; the existing port-8080
  server was not upgraded by these checks. External integrations remain untested.

- 2026-10-18 PR #1 Bun equivalent: created codex/bun-source-map-js-update from
  foundation commit bc8f85e. Added a targeted source-map-js 1.2.2 override and
  regenerated bun.lock with Bun 1.3.14. No other resolved package changed.
  A plain bun update initially added a direct dependency while retaining the old
  PostCSS copy; those intermediate changes were discarded before the override.
  Fresh isolated frozen install, type checks, nine unit tests, and build pass.
  Verified PostCSS resolves 1.2.2 and generates a readable source map with the
  original CSS location. This is a compatibility check, not a vulnerability exploit
  test. Lint remains 53 errors / 30 warnings. Backend checks were not rerun for
  this build-dependency-only change. Existing running app dependencies were not
  replaced; verification used a separate temporary install.
  This branch depends on the unpublished Bun foundation; review its incremental
  diff against codex/local-development-foundation. PR #1 remains open; no new PR,
  push, merge, or production deployment was performed. Main remains 37284f0.

- 2026-10-18 local toolchain activation: installed verified Bun 1.3.14 at
  ~/.bun/bin/bun, added duplicate-safe PATH setup to .zprofile/.zshrc, and backed
  up pre-existing startup files with .before-schreiber-bun suffixes. A fresh
  interactive login shell resolves Bun correctly. Frozen install in the actual
  checkout succeeded without changing bun.lock. Confirmed local Docker startup
  without resetting data. Replaced two old repo Vite processes with one guarded
  dev:local server on 127.0.0.1:8080. All seven non-lint verification checks pass;
  existing 53 lint errors / 30 warnings remain. Browser login with the synthetic
  employee succeeded, and the Time Off screen loaded. Screenshot evidence saved
  to /tmp/schreiber-local-bun-verified.png (temporary). No production operations.

- 2026-10-18 Bun alignment: adopted the user-confirmed Bun 1.3.14 and existing
  text bun.lock. Added packageManager metadata; CI reads that version and runs
  frozen installs. Verification and local preparation scripts now use bun run;
  existing Node runtimes and pinned npx Supabase CLI remain explicit tooling
  dependencies. Updated setup/verification/agent docs. Fresh temporary install
  using only bun.lock passed app type/unit/build checks without changing the lock.
  All four backend checks also passed using the fresh Bun dependency installation
  against the existing disposable Docker instance (no reset).
  Removed package-lock.json and bun.lockb after that validation; their prior
  contents remain in Git history. Lint remains 53 errors / 30 warnings.
  Bun was not present on this Mac's PATH; validation used an isolated temporary
  1.3.14 installation, not a global installation. No dependency update was made
  to bun.lock, so the source-map-js update from PR #1 remains a separate task.

- 2026-10-18 review correction: tightened the local smoke, permission, and HR
  tests. Authorization failures require SQLSTATE 42501; reversed dates require
  23514 and the time_off_dates_valid constraint; negative benefit values require
  P0001 and the specific validation message. RLS-filtered compensation updates
  must succeed with zero affected rows, not an arbitrary error. Service-account
  read-back confirms rejected inserts are absent and rejected updates preserve
  the entire row. Valid cancellation may change only status and updated_at.
  Attempted insert IDs are registered for cleanup before each write, including
  failure paths. All four verify:backend checks and targeted ESLint pass.
  Initial date-test expectation was corrected after checking the actual constraint;
  no schema or application behavior was changed. Main remains 37284f0; no push,
  merge, or deployment. The migration/infrastructure packaging review remains open.

- First lint cleanup batch: removed 75 errors (128 -> 53); 30 warnings remain.
  Replaced frontend caught `any` values with `unknown` and a checked error-message
  reader; preserved API/native error messages and workflow fallback text. Added
  eight regression cases for native/API errors and malformed thrown values.
  Removed redundant query-result casts, typed contact/submittal/attendee writes
  from generated schema types, and fixed props aliases, schedule declarations,
  and the Tailwind ESM import. The attendee lookup now follows its declared
  table-returning RPC shape (also confirmed in the SQL migration).
  Full local verification passes all seven non-lint checks (nine unit tests total);
  lint still fails with 53 errors / 30 warnings. Initial sandbox run could not access
  Docker; rerun with Docker access completed successfully apart from lint.
  Edge Function payloads, frontend JSON boundaries, generated preview auth timer,
  and hook/refresh warnings still require review. Generated Lovable files and
  Edge Functions were not changed in this batch. No rules were disabled.
  No commits, pushes, branch switches, merges, or production changes were made;
  main remains `37284f0`, develop and feature HEAD remain `5a81add`.

- Baseline synchronization: fetched origin and reviewed its two newer commits
  (preview auth storage and generated types). Fast-forwarded only the feature branch
  to `5a81add`; develop already matched. Preserved all uncommitted work and verified
  main stayed at `37284f0`. Incoming types also reference `email_queue_dispatch`;
  catalog inventory covers tables/columns only and does not certify function parity.
  Post-update verification: all seven non-lint checks pass; lint now has 128 errors
  and 30 warnings (one additional error in incoming previewAuthStorage.ts).

- Branch correction: discovered that previous work remained uncommitted on local
  main. Created/switched to the foundation feature branch and created local develop.
  No commits, merges or pushes occurred; main's commit was verified unchanged.

- First implementation: Docker local backend, synthetic seed, local-only migration
  exceptions, guarded local startup command, environment-aware upload/function URLs,
  API smoke test and browser submission. See `local/AUDIT.md` for detailed evidence.
- Follow-up: added repeatable schema inventory and permission regression commands;
  confirmed a third missing HR table and two permission defects. No production
  changes, commits, pushes, or remote configuration changes performed.

- Schema reconciliation: received user export; restored three HR tables, removed missing-
  table trigger guards, rebuilt disposable local data, and verified 60-table inventory.
  Added HR regression tests. Reproduced time-off defects before the forward fix; after
  local application, permission, happy-path, HR and inventory checks all pass.

- Verification gate: added `npm run verify` and app/backend/lint groups, .nvmrc,
  GitHub workflow definition, agent instructions and lint backlog. Combined local
  run: seven checks pass and lint fails as expected (127 errors, 30 warnings).
  A clean temporary npm install plus app type/unit/build checks also pass. Workflow
  YAML parsed locally; remote GitHub execution and branch protection are NOT done.

The package-lock.json changes predate this work; their contents were preserved
unchanged in a separate checkpoint commit on 2026-10-18.
