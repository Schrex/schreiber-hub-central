# Verification gate

Use Bun 1.3.14 (`packageManager` in `package.json`) with `bun.lock`, and Node
26.8.2 (`.nvmrc`) for existing Node scripts. CI installs the declared Bun version;
check `bun --version` locally. `packageManager` does not itself install Bun.
Use `bun run test` to invoke Vitest; bare `bun test` is a different test runner.
The Supabase CLI remains pinned to 2.121.0 and launched with npx as an isolated
CLI tooling exception. npm must not install application dependencies.

```sh
bun install --frozen-lockfile
bun run local:start
bun run verify
```

`verify` collects results from all groups rather than hiding checks after the first
failure. It exits nonzero if any check fails. It never starts, resets, migrates, or
deploys a backend. After migration changes, rebuild disposable local state with
`bun run local:reset` before verification (this deletes synthetic local data).

| Command | Checks | Docker required |
| --- | --- | --- |
| `bun run verify:app` | TypeScript, Vitest, production build | No |
| `bun run verify:backend` | Catalog inventory, time-off workflow, permission regressions, HR workflow | Yes; local backend must be running |
| `bun run verify:lint` | All ESLint rules | No |
| `bun run verify` | All three groups, with final summary | Yes |

Verification builds override the existing .env with loopback URL/test placeholders.
The resulting dist is a verification artifact, **not a production release artifact**.
API tests obtain only the fixed local backend credentials. No production secrets are
needed. Tests create synthetic requests/records and remove them; audit/notification
rows may remain. Avoid concurrent runs of backend tests on the same local instance.

## Current evidence

- Bun 1.3.14 clean frozen installation verified in a temporary directory using
  only `bun.lock`; the lockfile remained byte-for-byte unchanged.
- TypeScript, 19 Vitest cases, and build passed with those fresh dependencies.
- Lint passes with zero errors and 30 existing warnings; no rule was waived.
- Backend verification results are recorded in DEVELOPMENT_PROGRESS.md.
- Bun 1.3.14 is now installed at `~/.bun/bin/bun` on this Mac. Fresh interactive
  login shells resolve it through `.zprofile` / `.zshrc`; existing terminals may
  need to be reopened. The actual checkout frozen install and all seven non-lint
  checks pass. Browser sign-in as the synthetic employee and navigation to Time Off
  were verified. Main and production were unchanged.
- The first GitHub-hosted Linux run passed app and fresh-backend checks; its lint
  job failed on the pre-cleanup code. The updated cleanup run is pending. Browser
  automation and external integration coverage remain pending.

## GitHub workflow

`.github/workflows/verify.yml` runs on pull requests, pushes to main/develop/codex branches, and
manual dispatch. Independent app/backend/lint matrix jobs report their own results.
The backend job recreates the disposable schema and synthetic seed on a fresh runner.
Cleanup runs even if checks fail. Jobs have read-only repository permissions and
perform no publishing or remote database operations.

The lint error backlog is resolved on the cleanup branch; 30 warnings remain in
[LINT_BACKLOG.md](LINT_BACKLOG.md). Branch protection is not configured, so a workflow
file alone does not enforce merge restrictions. The older dependency PR heads do not
contain this follow-up cleanup yet.

Feature push CI was observed after adding the codex/** trigger. Previous PR events
had no runs; their exact cause remains unconfirmed. No default-branch change was
needed. All verification jobs are test-only and do not deploy.

Additional one-off static validation: Deno 2.5.6 check with --no-lock and
--node-modules-dir=none passed for the 15 edited Edge Function entry points. This
uses Deno's dependency cache and does not modify Bun's install. It is not yet a CI
job, does not execute handlers, and does not validate external integrations.
