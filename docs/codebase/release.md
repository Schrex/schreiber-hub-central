# Release, CI and docs map

Part of the [codebase map](README.md). Last checked @ `f026a29`. Authoritative detail:
`docs/release-process.md`, `docs/production-baseline.md`, `docs/manual-frontend-operations.md`.

## Environments

- **Production**: Cloudflare Pages project `schreiber-hub-preview` (production branch `main`)
  + Supabase `acgqjjbrnkmeazswdnzp` (display name "schreiber-hub", formerly "hub-rehearsal").
  No staging; preview URLs do not isolate data.
- **"Rehearsal" = production.** `bun run dev:rehearsal` (127.0.0.1:8083) points the local UI at
  the live project with real data (anon key prompt). `scripts/rehearsal-*` and
  `scripts/rehearsal/*.sql` are historical migration-era operators — do not run.
- **Local**: disposable Docker Supabase, see [backend.md](backend.md#local-backend).
- Lovable: Cloud project paused, GitHub access removed.
- Pages/Access tokens expire 2027-01-20.

## Branch → release flow

1. `feature/*` branch from `origin/develop` → PR into `develop` (all five verify groups pass).
2. Owner-approved release PR `develop` → `main`. **Merging to main does not deploy.**
3. **Production candidate build** (`release-candidate.yml`, dispatch on main, full SHA):
   `release-guard.mjs` requires a green Verification run for that exact SHA; builds with repo
   variable `PRODUCTION_SUPABASE_ANON_KEY`; outputs `release.json` + SHA256 manifest.
4. Owner approves SHA, run and manifest digest.
5. **Manual frontend upload or recovery** (`release-operation.yml`, main):
   `mode=plan` → `mode=preflight` (read-only Cloudflare + ledger) → `mode=execute`
   (needs `PRODUCTION_FRONTEND_ENABLED=true`, confirmation `DEPLOY <sha>`, expected deployment
   UUID, HTTPS recovery reference).
6. Verify live build-info and routes; update `docs/production-baseline.md`.

Guards (`scripts/release-policy.mjs`, `release-operation.mjs`): hardcoded project/backend,
static files only, hash match to approved digest, artifact from successful main candidate run,
new source must descend from deployed source, GitHub Deployments ledger + concurrency lane.
Recovery = separate `operation=recover` with an exact prior deployment UUID; no auto-rollback.
Uncertain outcome → stop and inspect; never blind retry or rollback.

Owner authorization is policy only — GitHub doesn't enforce branch protection or reviewers.

Backend changes (migrations, Edge functions) are separate from the frontend upload: one SQL
file at a time in a transaction against the named project, deploy only the specific function.

## CI (`.github/workflows/`)

| Workflow | Trigger | Does |
| --- | --- | --- |
| `verify.yml` | PRs, push to main/develop, dispatch | 5 matrix jobs: app, backend, lint, edge, browser (starts local Supabase, Chromium) |
| `release-build.yml` | dispatch, main | Non-deployable dry-run artifact |
| `release-candidate.yml` | dispatch, main | Deployable candidate (no Cloudflare creds) |
| `release-operation.yml` | dispatch, main | Deploy / recover: plan, preflight, execute |
| `release-ledger-probe.yml` | dispatch | Non-production ledger diagnostic |

## Verification

`scripts/verify.mjs` groups: **app** (typecheck, test, build), **backend** (schema audit +
6 local API suites; Docker + running backend), **lint**, **edge** (Deno check via npx),
**browser** (Playwright, 6 specs). It forces local `VITE_*` values so builds never embed `.env`.
`scripts/migration-*.test.mjs` are not in `bun run test`; run with
`bunx vitest run --config scripts/migration-vitest.config.mjs`.
First Playwright run: `bunx --no-install playwright install chromium`.

## Docs inventory

Current: `README.md`, `CLAUDE.md`, `DEVELOPMENT_PROGRESS.md` (status + open gaps),
`docs/production-baseline.md`, `docs/release-process.md`, `docs/manual-frontend-operations.md`,
`docs/add-employee-release.md` (candidate, not authorized), `local/README.md`,
`local/VERIFICATION.md`, `SECURITY.md` (PII/compensation policy).

Historical (evidence only, "do not rerun"): `docs/migration-*.md`, `docs/verification/*`,
`docs/archive/*`, `local/AUDIT.md`, `local/LINT_BACKLOG.md`, `local/SCHEMA_RECONCILIATION.md`,
`local/SCHEMA_REQUEST.md`, `local/reference/`, `.lovable/plan.md`.
Real migration exports live outside the repo (`~/Schrex/archive`).
