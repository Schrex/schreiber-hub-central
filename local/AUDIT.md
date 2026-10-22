# Local foundation audit — 2026-10-16

This records the initial baseline. The three missing HR tables and time-off permission
defects have since been addressed locally; see [schema reconciliation](SCHEMA_RECONCILIATION.md)
and [current progress](../DEVELOPMENT_PROGRESS.md). Historical findings below are retained.

Scope: repository inspection and isolated local execution. No production database,
account, deployment, GitHub setting, or Lovable setting was modified. No commit or
push was made. The pre-existing package-lock.json changes were left untouched.

## Observed baseline

| Check | Result |
| --- | --- |
| Production frontend build | Pass; main JS bundle about 1.92 MB / 563 KB gzip |
| TypeScript application and Vite config checks | Pass |
| Existing Vitest suite | Pass, but only one placeholder test |
| Existing full lint | 127 errors, 30 warnings |
| GitHub Actions in checkout | None |
| Unmodified migration replay | Fails; prerequisites and HR table definitions missing |

## Verified after local setup

- Local Supabase runs under Docker project `schreiber-local`, API port 55321.
- Generated migration replay completes with the four documented local exceptions.
- Local seed removes historical public business rows and creates three synthetic accounts.
- `npm run test:local` passes real Auth/API assertions for sign-in, creating a pending
  request, cross-user read/insert isolation, invalid dates, admin approval, and read-back.
- Browser sign-in as `employee@example.test` succeeds. Submitting a vacation request
  for October 31 shows the synthetic reason and Pending status in My Requests.
- `npm run typecheck`, `npm run test`, and `npm run build` pass after the changes.
- Two hardcoded production upload URLs and one project-ID-derived function URL now
  use `VITE_SUPABASE_URL` so they follow the selected backend.

The browser-created synthetic request remains for inspection. No email was sent;
the API approval test does not call the UI's transactional-email path.

## Findings to resolve before broader feature work or release

1. **Schema parity:** obtain an authoritative Cloud schema export, including policies,
   triggers, functions and relevant configuration. The two missing HR table definitions
   and Cloud-specific Realtime ownership cannot be reconstructed reliably from client types.
   Confirm production Postgres version; local currently uses 17.
2. **Credentials in history:** migration `20260419193344` contains named employee
   account creation and a plaintext shared default password. Check whether any live
   accounts still use it and rotate those credentials if so. This audit did not test
   those credentials against production. Local replay excludes that account seed.
3. **Integration parity:** Edge Functions and Realtime are disabled locally. Add safe
   substitutes/test credentials and validate each integration deliberately.
4. **Authorization coverage:** the smoke test covers cross-user access for time off,
   not all allowed state transitions, roles, tables or service-role functions.
5. **Quality checks:** triage existing lint failures, replace the placeholder test with
   meaningful coverage, and introduce required CI before release-branch protection.
6. **Performance:** investigate route-level code splitting and measure actual workflows
   with representative data and devices; bundle size alone is not a latency benchmark.
7. **Delivery:** establish staging, branch policy, schema/function deployment procedures,
   backup verification and a recovery rehearsal. This first proof is not release-ready.

## Development boundary

Use `npm run dev:local`. The original `npm run dev` continues to use the existing
environment files and can target production. The isolated command requires the
exact local API URL and supplies its frontend keys only to the Vite child process.
Public map/weather requests remain possible; no general network sandbox is claimed.
