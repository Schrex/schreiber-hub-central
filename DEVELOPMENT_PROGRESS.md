# Development progress

## Cobblestone look-ahead grid (CL-1) — November 5, 2026

Local-only candidate migration, seed, and job-page tabs for a published
Mon–Fri task grid on synthetic Cobblestone (`J2607`). Not applied to production.
`supabase/migrations/` was not edited. Editor, XML import, and the Problem
button are later tickets.

Verified on a disposable local backend: `verify:app`, `verify:lint` (30 existing
warnings, 0 errors), `verify:edge`, `verify:backend` (including
`test:local:lookahead`), and `verify:browser`.

## Production baseline — October 22, 2026

The verified release at `ac61bb695304d2cb319f5c3605d43f446ed99bca` is the starting
point for production work going forward. See [production baseline](docs/production-baseline.md)
for the deployment identity, recovery evidence, operating rules, and open items.

The deployment workflow is complete: all five exact-main verification groups,
candidate integrity, authenticated preflight, ledger writes, live upload, and
read-only recovery preflight passed. No actual rollback was performed.

## Cleanup before Add Employee

- Integrated the two release-evidence commits into this cleanup branch from develop.
- Consolidated current status here; retained the complete dated history in the
  [historical progress archive](docs/archive/development-progress-through-2026-10-22.md).
- Refreshed Lovable settings: the old Cloud project is paused and its database inactive.
- Removed Lovable GitHub App access to schreiber-hub-central; preserved existing
  access to hcss-readonly-mcp-server. Other installed apps were not changed.
- Retained production and recovery archives. No employee data, backend schema,
  production configuration, or Add Employee behavior was changed.
- Archived all pre-cleanup Git refs in private draft release
  `pre-production-cleanup-20261022`; downloaded it back and verified both checksums.
  Bundle SHA256: `2dfc5b97acc13aa196cb606006bd30a90b65136d7b37ef2470f52b9589a99ca7`.
- Removed seven obsolete remote branch names and nine obsolete local branch names.
  Unique historical integration/export commits remain recoverable from the bundle.
- Two clean worktrees (job-files and release-reconciliation) belong to other chats.
  The app refused archive/attachment from this chat; their directories were preserved.
- Repository webhooks and deploy keys are empty; the three Actions secrets are
  required by the current release workflow. Removed disposable dist, Python cache,
  and browser outputs after retaining local verification evidence.
- Full local verification passed: app, backend, lint, Edge and five browser workflows.
  Lint retains 30 existing warnings and zero errors. No runtime files changed.

## Add Employee implementation candidate — October 22, 2026

- Branch `codex/add-employee-enablement` starts from current origin/develop
  (`fe907989f4885d6a0dd386f3f09af6fb9192309e`); production baseline is unchanged.
- Replaced unchecked profile/role writes and partial-success position warnings
  with explicit service-only RPCs and checked Auth compensation. The candidate
  works with signup trigger enabled or disabled and without broad service-role
  employee_contacts SELECT access. No existing trigger is activated.
- Kept admin/office/foreman contact creation and admin-only login/position rules.
  Fixed actionable Edge error display, pending/uncertain submission handling,
  hidden position-toggle state and masked initial-password entry.
- First full verification passed all five groups: 153 app tests, 71 release tests,
  backend checks including synthetic onboarding, Deno checks, and six browser
  workflows. Fresh synthetic migration replay and all five groups also passed.
  Expanded concurrency, failed cleanup and lost reservation/Auth response checks
  passed, followed by the employee browser regression. Lint retains 30 existing
  warnings and zero errors.
- [Exact release and recovery scope](docs/add-employee-release.md) covers only
  three additive candidate RPCs, create-employee Edge function, and frontend.
  Applied migration history is unchanged; SQL remains in local/candidate-migrations.
- Production execution, frontend enablement and real-employee creation remain
  unauthorized. No real employee details have been supplied. Login uses the
  existing admin-entered initial password flow; no invitation or forced password
  change has been added. Hosted gateway and actual employee acceptance remain open.

## CI Verification speedup — October 26, 2026

- Branch `feature/ci-speedup` (PR #29 into develop). CI starts Supabase without
  studio, postgres-meta, mailpit, imgproxy, logflare, vector and supavisor; dropped
  the backend stop step; caches Playwright browsers; no longer verifies develop
  pushes or the develop→main release PR. Main push runs are unchanged (release guard).
- Measured run 40334350440 (all five groups passed) against run 40332383998:
  Supabase boot 107–108s → 83–88s; backend job 159s → 126s; browser job
  210s → 185s; run wall time 214s → 189s. Earlier runs ranged 3.2–4.9 min.
- Verification runs per change drop from four to two (feature PR + main push).
- The Playwright cache was cold on this run (saved afterwards); its ~10s gain is
  unmeasured. Skips for develop pushes and the develop→main PR are untested until
  the next release PR.
- Remaining boot time is ~70s of core image pulls (postgres, auth, rest, storage,
  kong) and ~15s of migrations and seed.

## Jobs status lifecycle candidate (#31) — October 26, 2026

- Candidate migration `20261026010000_jobs_status_lifecycle.sql` (local only, wired into
  `prepare-local.mjs`); `test:local:jobs-status` added to `verify:backend`.
- Verified locally after `local:reset`: verify:backend, verify:app, verify:lint pass
  (lint: 30 existing warnings). Supabase types regenerated from the local backend with CLI
  2.121.0 + prettier (output shape changed: `ComputedFields`, no `__InternalSupabase`).
- Not verified: production. Release review steps in `docs/jobs-status-release.md`.
- Released to production 2026-10-26: migration applied, `request-truck` v12, frontend `8232a07`
  (deployment `a4ea3102…`); smoke test passed. Record: `docs/jobs-status-release.md`.

## Jobs pickers follow status rules (#36) — October 26, 2026

- Schedule carry-forward copies only active-job assignments and uses `todayInNewYork()`.
  Dispatch order picker: active jobs plus an edited order's current job. Accident/violation
  pickers: active + on hold. `request-truck` returns 409 for non-active jobs; the client
  toast now shows the server message.
- Verified locally: `e2e/job-status-pickers.spec.mjs`, verify:app, verify:edge, verify:lint,
  verify:browser. Not verified: `request-truck` runtime (Edge runtime disabled locally), production.

## Jobs Active/Archive review fixes (#28) — October 26, 2026

- No Undo after leaving `complete` (trigger would re-stamp completed_by/completed_at); status
  sheet Save waits for future-entry counts; crew-count failure no longer hides context; foreman
  archive search capped at 50 profile ids; no per-year counts; carry-forward picks the latest
  prior day, then copies its active-job rows; Jobs page back on the real role; `isShopJob`.
- Jobs e2e specs converted to `.mjs`. Release doc: apply migration before deploying the frontend.
- Verified locally: verify:app, verify:lint (30 existing warnings), verify:edge, verify:backend,
  verify:browser (13 tests). Not verified: production.

## Access-policy module for UI role gating (#43, #44–#53) — October 27, 2026

- Branch `feature/access-policy`. All UI role gating goes through `src/lib/access.ts`
  (`can`/`useAccess`) over rule data in `src/lib/accessRules.ts`. Preview is honoured everywhere
  (admin previewing hides `/hr`, `/admin/*`; role switcher stays usable); any role held counts,
  like `has_role()`; `useAuth` stays loading until roles load (no bounce home on direct admin
  route opens); employee-contact edit/delete now office|admin, matching RLS.
- Contract (#52): guard `src/test/noInlineRoleChecks.test.ts` fails on inline role-literal
  comparisons outside `lib/access*` / `hooks/useAuth.tsx` (allowlist empty). TimeOff notice
  period moved to a `NOTICE_POLICY` lookup (same behaviour: real primary role, foreman 28 days).
  No `effectiveRole ?? role` fallbacks remain; `effectiveRole` is display-only (Index).
- RLS parity (#53): `test:local:access` in `verify:backend` — 81 rule checks across 390 probes,
  UI never exceeds RLS; wider RLS only where a rule records `narrower` (dig tickets, permits,
  plans, dispatch, schedule). Tables only; storage buckets not probed.
- Verified locally (`bun run verify`, all PASS): typecheck, test (34 files / 443 tests), build,
  local:audit-schema, all `test:local*` incl. access, lint (30 existing warnings, 0 errors),
  typecheck:edge, test:browser (13 Playwright specs).
- Review fixes (`feature/access-review-fixes`): roles query errors deny and retry on the next
  auth event / resume; readiness no longer waits for profile/position; one pure decision
  (`lib/accessDecision.ts`) shared by `can()`, the RLS probe and `effectiveRole`; TimeOff notice
  uses the preview (effective) role, unit-tested (`timeOffNotice.test.tsx`, `useAuthReady`).
- Not verified: production (untouched, nothing released), Realtime, storage-bucket parity for
  the access rules. Remaining UTC "today" uses
  (`lib/currentPositions.ts`, MyPosition, AdminPositions, Dispatch, job sections) are unchanged.

## Lovable code dependencies removed — November 3, 2026

- Lockfiles (`bun.lock`, `remotion/bun.lock`) no longer point at Lovable's private npm cache;
  frozen installs work from the public registry with unchanged integrity hashes.
- Frontend: removed `lovable-tagger`, `@lovable.dev/cloud-auth-js`, `integrations/lovable` and
  the Lovable preview auth broker (session now in `localStorage`). Google sign-in uses Supabase
  OAuth; still disabled under `independentLaunch` and not configured in production.
  Link-preview images use `app-icon.png` instead of Lovable file storage.
- Parked AI and crew-SMS features (`parked/README.md`): categorize-document,
  extract-foreman-brief, extract-scope-from-contract, generate-toolbox-talk,
  suggest-safety-topic and notify-talk-attendees moved to `parked/edge-functions/` (not
  deployed, not in `typecheck:edge`); their UI is off in every build via `integrationsParked`.
  Parked code is Lovable-free (provider-neutral AI adapter, direct Twilio) but untested.
- Email is Postmark-only: Lovable send path, Lovable suppression webhook branch and
  `preview-transactional-email` removed. `process-email-queue` still requires
  `EMAIL_PROVIDER=postmark`, so an unset secret keeps delivery off as before.
- Verified in a cloud session: `verify:app`, `verify:lint`, `deno check` on changed Edge
  functions. Full `typecheck:edge` cannot run there (esm.sh blocked); CI covers it.
- Not done: nothing deployed. Edge function changes take effect only through a release; production may
  still have the old `preview-transactional-email` and the parked functions deployed (unchecked); deleting
  them is a separate authorized operation. Committed `.env` still names the old
  Lovable project (not inspected). Applied migration names and the `talkMedia` legacy URL
  rewrite intentionally keep Lovable-era identifiers.

## Outstanding operational items

- Per the owner, Deepgram/ElevenLabs features are out of scope. Removed both saved
  API secrets from the paused old Lovable project and verified their absence.
  This does not claim vendor-side key revocation; no vendor account was accessed.
- Lovable billing cancellation remains deferred by the owner's prior choice.
- Destination database/Auth/Storage backup and isolated restore proof remain open;
  frontend recovery archives do not cover them.
- Automatic application email remains off at the last recorded check. External
  integrations, Realtime, and complete employee workflow acceptance remain separate.
- GitHub reports two high-severity SheetJS (xlsx) advisories; retain as dependency
  remediation work, not silently resolved by this documentation cleanup.
