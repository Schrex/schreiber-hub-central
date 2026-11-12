# Isolated local development

This is the disposable synthetic development environment. The hosted project
`acgqjjbrnkmeazswdnzp` is production, even where historical tooling calls it rehearsal.
See the [production baseline](../docs/production-baseline.md) for current operations.
Production Cloud configuration and migration files are not changed by these commands.
See [audit findings and verification results](AUDIT.md) for the current baseline.
The current milestone and release checklist are tracked in
[DEVELOPMENT_PROGRESS.md](../DEVELOPMENT_PROGRESS.md).
For the combined verification command and CI status, see [VERIFICATION.md](VERIFICATION.md).

Additional diagnostic commands:

```sh
bun run local:audit-schema
bun run test:local:permissions
bun run test:local:hr
bun run test:local:storage
bun run test:local:roles
```

Accident-photo replacement regression: `node scripts/local-accident-photo-replacement.mjs`
temporarily installs the reviewed candidate on the fixed disposable local backend,
runs 590 Storage HTTP checks, cleans synthetic fixtures and restores the exact prior
policy catalog. It never accepts a hosted target. The broader suite covers 14 private
local buckets; local talk-media is public and is excluded, unlike the private destination.
The candidate is installed separately on schreiber-hub with guarded catalog checks;
this local command does not prove hosted role-based HTTP behavior.

These checks now pass after the supplied schema reconciliation and local permission
fix. They do not certify complete production parity. See
[reconciliation details](SCHEMA_RECONCILIATION.md) and the progress record.

Private migration permission regression (requires the authorized private export archive):
`python3 scripts/local-grant-proposal.py --candidate` tests the proposed grants and
attendance recursion candidate inside a rollback-only synthetic transaction. Without
`--candidate`, it reproduces the original recursion and intentionally exits 2. Neither
command applies the candidate persistently or contacts a hosted database. Keep this
archive-dependent check separate from CI and ordinary synthetic backend verification.

## Start

### Hosted migration rehearsal

`bun run dev:rehearsal` starts a separate frontend at `http://127.0.0.1:8083`,
fixed to `hub-rehearsal` (`acgqjjbrnkmeazswdnzp`). This is **real restored data**,
separate from the synthetic local backend. It does not change `.env` or hosted
access settings. Use Node from `.nvmrc`.

Enter that project's **legacy anon** key at its hidden Terminal prompt
(Supabase Settings → API Keys → Legacy). Never use service_role, the database
password, or the JWT signing secret. The launcher rejects privileged and
wrong-project JWT claims; Supabase verifies the actual signature. The key is
passed to Vite in memory and is necessarily visible to the browser as a client
key; it is not written to a configuration file. Opaque publishable keys are not
accepted because this launcher cannot verify their project from their contents.

Rehearsal mode disables Google and hides signup in the sign-in screen. These are
UI controls, not authorization boundaries. Hosted signup, email delivery, Data API
and all other isolation controls retain their existing settings. Login cannot
be accepted until the hosted password provider and required client access have
been reviewed and enabled for the controlled test. Do not use synthetic test
scripts against this project, run routine edits, or reuse source Storage URLs as
proof of independent file restoration. Stop the server with Ctrl-C.

Launcher checks: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/rehearsal-dev-test.py`.

After authorized hosted login, the optional
`http://127.0.0.1:8083/local/rehearsal-read-check.html` runs read-only checks using
the current session. It requires the fixed rehearsal configuration and an
employee-only role. It prints statuses rather than rows/credentials, checks a
sensitive-column HEAD denial and reports cross-user compensation visibility.
A zero result alone does not prove filtering without a known-existing other-user
record. This does not test mutations or substitute for foreman/admin acceptance.

### Synthetic local development

Prerequisites: Bun 1.3.14, dependencies (`bun install --frozen-lockfile` on a fresh checkout), Node from `.nvmrc`,
Docker Desktop running, and network access for the initial CLI/container downloads.
The original validation used Node 26.8.2, npm 11.19.1, Supabase CLI 2.121.0 and local
Postgres 17. The supplied Cloud export reports Postgres 17.6 (same major version).

Bun and `bun.lock` are now the dependency standard; `packageManager` records the
version and CI installs it explicitly. Node/npx remain for the pinned Supabase CLI
and existing Node scripts. The packageManager field alone does not install Bun
or force an already-installed Bun binary to change version; check `bun --version`.

```sh
bun install --frozen-lockfile
bun run local:start
bun run test:local
bun run dev:local
```

- Frontend: http://127.0.0.1:8080
- Local backend API: http://127.0.0.1:55321 (not a frontend page)
- Local database studio: http://127.0.0.1:55323
- Captured authentication email: http://127.0.0.1:55324

Synthetic accounts: `employee@example.test`, `other@example.test` (employees),
`admin@example.test`, `admin2@example.test` (admins) and `foreman2@example.test` (foreman). Each
uses the disposable local password `LocalOnly-12345!` and is linked to a synthetic employee
record with a fixed hire date (employee 2015-03-02, other 2022-07-01, admin 2010-01-04, admin2
2012-05-14, foreman2 2019-08-12). The second admin makes "a different admin decides" rules
testable. `bun run test:local:time-off` (part of `verify:backend`) checks them and holds the
time-off backend checks; its helpers live in `scripts/local-time-off-support.mjs`.
Use email/password sign-in; Google sign-in is disabled in this local mode.

### Click-through demo (one command)

To try a feature by hand, run `bun run local:demo`. It starts Docker if a cloud session
has it stopped (on a laptop, open Docker Desktop first), starts the backend if needed, adds
synthetic demo data, and serves the app at http://127.0.0.1:8080 until Ctrl+C. Rerunning it is
safe. Demo data: job `Demo Main St Sewer` (DEMO-001) scheduled today (New York) for
`foreman@example.test` (foreman), `crew1@example.test` and `crew2@example.test` (crew), plus
two toolbox talks, one with a quiz. Same password as above.

- `bun run local:demo --seed-only` adds the data without starting the app.
- `bun run local:demo --clean` removes it again; the backend keeps running.
- In Claude Code, ask for "the local test environment" (`.claude/skills/local-test-env`).
  Cloud sessions cannot show the app to you (no preview, no inbound connections); there Claude
  drives it with Playwright and sends screenshots, or you run it on your own computer.
- Starting a toolbox talk as a foreman currently fails with an RLS recursion error; the fix is
  the unapplied candidate `20261019220000_attendance_policy_recursion.sql`.

`dev:local` gets keys from the local CLI, requires the exact loopback API URL,
and passes frontend settings only to the child Vite process. It does not write
credentials to tracked files or change the production `.env` file. A service-role
key is used only by the smoke test for cleanup, never passed to Vite.

**Use `dev:local`, not `dev`, for isolated work.** The original `dev` command
uses existing environment files,
which may point at production. `build` likewise uses existing build settings.

## Stop or recreate

```sh
bun run local:stop
# Only when you want to discard all disposable local data:
bun run local:reset
```

Start preserves existing local data. Reset rebuilds the local database and seeds it
again. Neither command links to or pushes to a hosted Supabase project. Do not use
this local work directory with remote `link`, `db push`, or deploy commands.

## What gets replayed

`local:prepare` creates the ignored `.local-backend/supabase` directory using
tracked migrations, this local config, and `local/seed.sql`. It copies no Edge
Functions or hosted credentials. The generated migrations are not release artifacts.

Four deliberate local differences from production history:

1. The account-only migration `20260419193344` is replaced with a comment, because
   it creates named employee accounts with a historical shared password.
2. A local prerequisite adds `positions.is_salaried` before migration
   `20260421010923` uses it. Its original creation in `20260426185114` is idempotent.
   This records an ordering defect in the existing migration history; it does not
   prove the live schema matches the repository.
3. `local/hr-bootstrap.sql` restores `benefit_types`, `employee_benefits`, and
   `employee_compensation_history` from the supplied Cloud definitions before their
   dependent historical migrations. The original trigger migrations now run without
   conditional skips. The export's generated-column syntax is normalized to PostgreSQL
   17 stored-generation syntax; complete production ACL parity remains unverified.
4. Migration `20260513013337` changes a Cloud-owned realtime table and fails local
   ownership checks. It is omitted only from the generated copy and Realtime is
   disabled locally. Live subscriptions, broadcast and presence are not validated.

The seed truncates public business tables and auth users **in this disposable
local database**, then creates synthetic identities through the existing triggers.
Storage bucket definitions remain. Historical business seed rows may exist during
migration replay; they are removed before this environment is ready for use.
Some configuration/reference tables are intentionally empty in this first proof.

The preparation script rejects migrations containing known outbound SQL calls or
cron scheduling. This is a review aid, not a general SQL/network sandbox. Review new
migrations before replay. The user supplied schema metadata; no production row data was imported.

## Coverage and limitations

`test:local` exercises real local Auth and database APIs: employee/admin sign-in,
time-off creation, cross-user isolation, invalid dates, admin approval, and employee
read-back. It deletes the created request; in-app notification rows can remain until
reset. It is not a browser test or a complete authorization audit.

Edge Functions are disabled, so transactional email, SMS, AI, transcription,
and other server workflows are unavailable and may show errors. Authentication
emails go to the local capture service. Public weather/map services and external
links in the frontend still exist; this is not a fully offline app.

Browser sign-in and a synthetic time-off submission were also checked manually.
Browser workflows and manual release controls are implemented. Expand feature-specific
coverage and verify hosted behavior only through separately approved checks.
Do not use a successful local smoke test as production
release approval.

The candidate `local/candidate-migrations/20261016210000_time_off_request_permissions.sql` is applied
locally only by an explicit copy in local:prepare. It is outside supabase/migrations
and cannot enter the normal migration replay from this PR. A future production fix
requires explicit release approval and a separately reviewed migration; do not copy
the entire local directory. Historical production migrations remain unchanged. Do
not deploy the local HR bootstrap to production: those HR tables already exist there.
A local reset invalidates prior local sessions and clears the old browser test request;
sign in again if needed.

## Automated time-off browser smoke

With the synthetic local backend running:

```sh
bunx --no-install playwright install chromium
bun run verify:browser
```

The test starts its own guarded frontend on 127.0.0.1:8082 and refuses to reuse an
existing server. Your normal dev:local app on 8080 can remain open. Three isolated
browser contexts use the seeded employee, other employee and admin accounts. The
workflow submits a unique vacation request, checks Pending, approves through the
admin UI, reloads the employee view to verify Approved, and checks the other user
cannot see that request. Existing API tests remain the authorization check.

Each run deletes only its own uniquely labelled request in finally; notification
rows can remain in the disposable database. Browser HTTP requests are restricted
to the frontend and local API. External email delivery and Realtime are not tested.
No production credentials are passed to the browser; the local service key stays
in the Node test process for cleanup. Traces are disabled to avoid capturing auth
payloads. Failure artifacts are ignored by Git and are not uploaded to CI artifacts.
The browser CI job creates its own fresh backend and installs Chromium automatically.

## Add Employee candidate

`bun run test:local:employee` exercises the production handler against fixed local
Auth/REST. It applies only the employee-creation candidate locally, temporarily
probes signup-trigger disabled/enabled and denied service-role SELECT, restores
those states, and cleans its synthetic records. `local:prepare` includes this
candidate in disposable replay. Run tests serially while the fault probes execute.
The browser suite adapts the same handler because local Edge runtime is disabled.
See [Add Employee release scope](../docs/add-employee-release.md) for exact candidate,
production execution/recovery gates and remaining acceptance limits.
