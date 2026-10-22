# Schreiber Field

Employee field app for Schreiber Excavating.

**Live app:** [app.schreiberexcavating.com](https://app.schreiberexcavating.com)

## Hosting and source control

The live frontend is hosted on Cloudflare Pages with an independent Supabase
backend. Lovable hosting and repository sync have been retired. The former
Lovable URL and editor are no longer the deployment or development workflow.

- Start feature branches named `codex/*` from `develop`; target `develop` in pull requests.
- `main` is reserved for explicitly authorized production releases. Do not push or merge to it as part of routine development.
- Production deployment is a separate, explicitly authorized operation; merging a pull request does not establish a release.
- See [project guidance](AGENTS.md), [development progress](DEVELOPMENT_PROGRESS.md), and [hosting and recovery notes](docs/migration-hosting-recovery.md).

Historical migration records and deferred integration code still reference Lovable.
Those references are retained for recovery and follow-up work; they do not mean
Lovable repository sync is active.

## Development

Use Bun **1.3.14**, pinned in `package.json`, and Node from `.nvmrc`.
`bun.lock` is the authoritative dependency lockfile. Install Bun using its
[installation instructions](https://bun.com/docs/installation), then confirm
`bun --version` reports `1.3.14`.

For isolated development with synthetic data, follow [the local backend guide](local/README.md).
Docker must be running before starting the backend.

```sh
bun install --frozen-lockfile
bun run local:start
bun run dev:local
```

Use `bun run test` for Vitest and `bun run verify` for the complete local checks.
Plain `bun run dev` uses existing environment configuration and can connect to the
live backend. Work on feature branches; main is reserved for explicitly approved releases.
