# Development progress

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
