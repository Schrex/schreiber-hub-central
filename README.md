# Schreiber Field

Let's create an app for Schreiber Excavatijg employees to access all the functions they need to

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://schreiber-hub-central.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/be4f9bee-f0ea-4d93-8142-1b82027df08c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

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
