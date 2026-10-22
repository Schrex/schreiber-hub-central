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
- Full local verification passed: app, backend, lint, Edge and five browser workflows.
  Lint retains 30 existing warnings and zero errors. No runtime files changed.

## Next feature: Add Employee (not started)

Keep onboarding disabled until synthetic local tests and reviewed fixes cover
contact creation, optional Auth login, profile/role creation, position assignment,
authorization, and cleanup on failure. Retained hosted evidence identified failed
automatic profile/role creation and denied service-role employee_contacts SELECT.
Do not treat the frontend button change as sufficient evidence of working onboarding.
Any hosted fix or new frontend release requires its own explicit authorization.

## Outstanding operational items

- Shared legacy provider credential revocation needs an exact inventory of keys and
  their consumers; do not revoke a key still used by another app.
- Lovable billing cancellation remains deferred by the owner's prior choice.
- Destination database/Auth/Storage backup and isolated restore proof remain open;
  frontend recovery archives do not cover them.
- Automatic application email remains off at the last recorded check. External
  integrations, Realtime, and complete employee workflow acceptance remain separate.
- GitHub reports two high-severity SheetJS (xlsx) advisories; retain as dependency
  remediation work, not silently resolved by this documentation cleanup.
