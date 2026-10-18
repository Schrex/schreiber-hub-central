# Project guidance

- `main` is production. Do not commit to, merge into, or push to main. Work on
  `codex/*` feature branches and target `develop` for integration. A future production
  release requires an explicit user instruction; general continuation is not authorization.
- Before edits, check the current branch. Current foundation work belongs on
  `codex/local-development-foundation`. Uncommitted changes are not branch-isolated
  until committed; preserve them when switching and do not switch back to main to edit.

- Read DEVELOPMENT_PROGRESS.md and local/README.md before infrastructure work.
  Record verified results and remaining gaps in the progress file after a milestone.
- Use npm with package-lock.json for checks, Node from .nvmrc, and npm 11.19.1.
- Use `npm run dev:local` for development. Plain `dev` uses existing environment
  files and can target production. Never use real employee data for routine tests.
- Start the disposable backend with `npm run local:start`. `local:reset` destroys
  synthetic local state; use it deliberately when checking a fresh migration replay.
- Run relevant `verify:app`, `verify:backend`, and `verify:lint` groups. `npm run verify`
  runs all groups and reports failures. Existing lint debt is documented, not waived.
- Keep applied production migration history intact. local/hr-bootstrap.sql is only
  for local reconstruction and must not be deployed against existing production tables.
- Do not equate local tests, client-type matching, or drafted CI with production
  parity or a successful release. External integrations and Realtime remain untested.
- Keep production deployment separate from local changes. Never put service-role
  keys in VITE_ variables. Avoid printing credentials or bringing employee rows into fixtures.
