# Project guidance

Codebase map (read before exploring; detail files on demand):
@docs/codebase/README.md
Update the map in the same change when routes, tables, Edge functions, environments or
release steps change.

- `main` is production. Do not commit to, merge into, or push to main. Work on
  `feature/*` branches and target `develop` for integration. A future production
  release requires an explicit user instruction; general continuation is not authorization.
- Before edits, check the current branch. Read docs/production-baseline.md for the
  verified production starting point. Start new feature branches from current origin/develop.
  Historical migration notes are evidence, not authorization to rerun changes. Uncommitted changes are not branch-isolated
  until committed; preserve them when switching and do not switch back to main to edit.

- Read DEVELOPMENT_PROGRESS.md and local/README.md before infrastructure work.
  Record verified results and remaining gaps in the progress file after a milestone.
- Use Bun 1.3.14 (packageManager in package.json) and bun.lock for dependencies.
  Install with `bun install --frozen-lockfile`; use `bun run test` to run Vitest,
  not the separate Bun test runner. Keep Node from .nvmrc for Node-based scripts.
  The pinned Supabase CLI and Deno static checker use npx as tooling exceptions; do not use npm install
  for application dependencies.
- Use `bun run dev:local` for development. Plain `dev` uses existing environment
  files and can target production. Never use real employee data for routine tests.
- Start the disposable backend with `bun run local:start`. `local:reset` destroys
  synthetic local state; use it deliberately when checking a fresh migration replay.
- Run relevant `verify:app`, `verify:backend`, and `verify:lint`, and `verify:edge`, and `verify:browser` groups. `bun run verify`
  runs all groups and reports failures. Existing lint debt is documented, not waived.
- Keep unapplied release candidates in local/candidate-migrations; promotion into
  supabase/migrations requires separate release review and explicit authorization.
- Keep applied production migration history intact. local/hr-bootstrap.sql is only
  for local reconstruction and must not be deployed against existing production tables.
- Do not equate local tests, client-type matching, or drafted CI with production
  parity or a successful release. External integrations and Realtime remain untested.
- Keep production deployment separate from local changes. Never put service-role
  keys in VITE_ variables. Avoid printing credentials or bringing employee rows into fixtures.

## Fast verification path

Run the narrowest check first, then the group before handing off.

| Change | First check | Before handoff |
| --- | --- | --- |
| One unit test / component | `bunx vitest run src/test/<file>` (~1s) | `bun run verify:app` |
| TypeScript types | `bun run typecheck` | `bun run verify:app` |
| Lint-sensitive edit | `bunx eslint <file>` | `bun run verify:lint` |
| Edge function | `bun run typecheck:edge` | `bun run verify:edge` |
| Migration / RLS / roles | matching `bun run test:local:<area>` (backend running) | `bun run verify:backend` |
| UI flow | `bunx playwright test e2e/<spec>` (backend running) | `bun run verify:browser` |
| scripts/migration-* or release-* | `bunx vitest run --config scripts/<migration\|release>-vitest.config.mjs` | `bun run verify:app` |

Unit tests live in `src/test/`; browser specs in `e2e/`; backend checks are `scripts/local-*.mjs`.
`.claude/settings.json` pre-approves these checks; commits, pushes, merges and `local:reset` still ask.

## Parallel sessions (git worktrees)

- One session per task, each in its own worktree: `scripts/worktree-new.sh <name>` creates
  `.claude/worktrees/<name>` on `feature/<name>` from origin/develop, installs deps and runs
  `local:prepare`. Open a session there; never let two sessions edit one checkout.
- All worktrees share one local backend (fixed ports 55321–55324). Start it once with
  `bun run local:start`; do not `local:reset` or `local:stop` while another session uses it.
  The backend runs the migrations of whichever worktree last started or reset it.
- `dev:local` (8080) and `test:browser` (8082) use strict ports: one worktree at a time.
- Remove a finished worktree with `git worktree remove .claude/worktrees/<name>` after its
  branch is pushed or merged.
