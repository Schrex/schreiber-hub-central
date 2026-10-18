# Development progress

Updated: 2026-10-18. This is the current status record; update it after each meaningful
verification or change. A successful local check never marks a production step done.

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
