# Verification gate

Use Node 26.8.2 (`.nvmrc`) and npm 11.19.1 for this initial baseline. npm and
package-lock.json are the verification dependency source; the existing Bun lockfile
has not been removed or updated. The Supabase CLI is pinned to 2.121.0 in commands.

```sh
npm ci
npm run local:start
npm run verify
```

`verify` collects results from all groups rather than hiding checks after the first
failure. It exits nonzero if any check fails. It never starts, resets, migrates, or
deploys a backend. After migration changes, rebuild disposable local state with
`npm run local:reset` before verification (this deletes synthetic local data).

| Command | Checks | Docker required |
| --- | --- | --- |
| `npm run verify:app` | TypeScript, Vitest, production build | No |
| `npm run verify:backend` | Catalog inventory, time-off workflow, permission regressions, HR workflow | Yes; local backend must be running |
| `npm run verify:lint` | All ESLint rules | No |
| `npm run verify` | All three groups, with final summary | Yes |

Verification builds override the existing .env with loopback URL/test placeholders.
The resulting dist is a verification artifact, **not a production release artifact**.
API tests obtain only the fixed local backend credentials. No production secrets are
needed. Tests create synthetic requests/records and remove them; audit/notification
rows may remain. Avoid concurrent runs of backend tests on the same local instance.

## Current evidence

- Combined local run: seven checks pass, lint fails (128 errors, 30 warnings after baseline synchronization).
- Clean npm dependency installation tested in a temporary directory, leaving the
  running checkout and pre-existing lockfile changes untouched. TypeScript, Vitest,
  and build also passed using that clean install.
- Workflow YAML parsed locally. GitHub-hosted Linux execution remains unverified
  until the workflow and supporting files are pushed and the first run is observed.
- Unit suite still contains a placeholder. Real behavior coverage comes from the
  local API tests; automated browser coverage and external integrations are pending.

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
checks for the agreed branch policy. No commit or push was performed in this phase.
