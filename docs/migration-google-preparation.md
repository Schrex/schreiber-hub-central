# Independent Google sign-in preparation

> Historical migration record. For current production identity and operating rules,
> use [production baseline](production-baseline.md). Do not rerun migration steps
> or treat earlier pending-state descriptions as current status.

Prepared 2026-10-19. Google sign-in stays in the migration scope. The application
now has an opt-in independent Supabase OAuth path; the existing Lovable path stays
the default. No hosted Auth setting, Google client, deployment or credential was
changed. This is code preparation, not a successful Google migration.

## Application behavior

- `VITE_GOOGLE_AUTH_MODE` unset/empty or `lovable`: existing Lovable broker behavior.
- `VITE_GOOGLE_AUTH_MODE=supabase`: calls the configured Supabase client's Google
  OAuth method with the current browser origin as `redirectTo`. It does not invoke
  the Lovable wrapper or pass broker tokens to `setSession`.
- Any other value fails with the existing generic sign-in error. There is no silent
  fallback to Lovable after a destination error.
- `VITE_LOCAL_BACKEND=true` takes precedence over either mode: the button remains
  disabled and the helper also rejects direct invocation. Local tests remain synthetic.
- The sign-in page catches returned/thrown errors and allows retry; raw provider
  error details are not shown to the user.

The existing Supabase client uses the installed SDK's automatic browser redirect
and callback-session detection. No separate callback route or manual token exchange
was added. The current `AuthProvider` observes the restored session and the sign-in
page routes signed-in users home. This implementation retains the client's existing
flow type; it does not claim to introduce PKCE or prove copied-identity continuity.

## Configuration template for a synthetic hosted test

These are **build-time placeholders**, not settings applied to any project. Use a
separate synthetic environment; do not connect branch previews to real-data rehearsal.

```dotenv
VITE_GOOGLE_AUTH_MODE=supabase
VITE_LOCAL_BACKEND=false
VITE_SUPABASE_URL=https://<synthetic-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<synthetic-project-publishable-key>
VITE_SUPABASE_PROJECT_ID=<synthetic-project-ref>
```

Do not place Google client secrets, service-role keys or database passwords in
`VITE_` settings. No tracked environment file has been edited. Changing these values
requires rebuilding the frontend; the mode flag alone does not select a new backend.
Verify the destination URL and browser publishable key together before deploying.

Before a real hosted test, the company Google Cloud/OAuth owner and Supabase admin
must configure the independent Google provider. Confirm the provider's callback URL
in the destination dashboard (normally
`https://<synthetic-project-ref>.supabase.co/auth/v1/callback`), the approved app
origin, Supabase site URL and exact allowed redirect origin. Use a dedicated test
identity and existing authorized accounts; do not incur paid services or provision
credentials as an implicit consequence of this document.

The app currently redirects to `window.location.origin`, so validate that exact
origin against the destination redirect allow-list. Do not enable wildcard previews
against the real-data rehearsal project. Later production configuration and rollout
require separate release authorization.

## Validation and remaining gates

Mocked helper tests cover default broker selection, independent OAuth arguments,
no broker session injection, local-mode precedence for both paths, invalid config,
provider errors, missing redirect URL and thrown network failure. UI tests cover
generic error/retry, the local disabled button and navigation with an existing
session. These tests do not call Google or restore a real Auth session.

With Bun 1.3.14 and Node 26.8.2, `verify:app` passes typecheck, Vitest and build.
`verify:lint` passes with 30 existing warnings and no errors. `verify:browser` passes
the existing synthetic time-off workflow (one test); it is not a hosted OAuth test.
The initial sandbox run could not resolve the pinned CLI registry; an approved
escalated retry passed against the existing local backend without a reset. Build
warnings about chunk sizes remain. No backend SQL or Edge Function changed for Google work.

Still required: a real synthetic hosted Google round trip, callback/error behavior,
sign-out and return login, intended application role/profile creation, independent
company account ownership and private copied-identity continuity after the export
is restored. A mocked session navigation test is not that proof. No current source
or destination Google settings have been asserted from these code tests.
