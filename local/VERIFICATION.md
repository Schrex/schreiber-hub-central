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
- TypeScript, nine Vitest cases, and build passed with those fresh dependencies.
- Lint still fails with the existing 53 errors and 30 warnings; no rule was waived.
- Backend verification results are recorded in DEVELOPMENT_PROGRESS.md.
- The verification used a temporary Bun installation because Bun was absent from
  this Mac's PATH. Install Bun 1.3.14 before using these commands in a new shell.
- GitHub-hosted Linux execution remains unverified. Browser and external integration
  coverage remain pending; passing unit tests do not certify those workflows.

## GitHub workflow

`.github/workflows/verify.yml` runs on pull requests, pushes to main/develop, and
manual dispatch. Independent app/backend/lint matrix jobs report their own results.
The backend job recreates the disposable schema and synthetic seed on a fresh runner.
Cleanup runs even if checks fail. Jobs have read-only repository permissions and
perform no publishing or remote database operations.

Lint intentionally remains a failing job until the [backlog](LINT_BACKLOG.md) is
resolved. This is not a fully green release gate. GitHub branch protection has not
been configured; a workflow file by itself does not enforce merge restrictions.

Activation: review the diff, commit/push all required setup files on a feature branch,
open a PR, inspect all three jobs, resolve failures, and then configure required
checks for the agreed branch policy. Local checkpoint commits exist; no workflow push or hosted execution has occurred.
