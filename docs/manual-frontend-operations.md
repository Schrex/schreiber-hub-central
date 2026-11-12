# Manual frontend upload and recovery

The workflows are integrated into main through approved PR #21. The account ID,
public backend configuration and encrypted Pages deployment token are configured.
The token expires January 20, 2027. All workflows remain manual and main-only.
Access credentials and policy are configured. The owner approved activation and
live execution 39846752862, which verified deployment
2c110f18-7411-4f63-9d09-3cc291a54470 at revision ac61bb6 on October 22, 2026.
Read-only recovery preflight 39847008622 passed; no rollback was performed.
A verified reconstructed recovery archive is retained; the original ZIP is missing.
The prior dry-run build remains available and remains non-deployable.

## Authenticated readiness checks

The controller supports `mode=preflight` in addition to plan and execute. Plan
continues to validate source/artifact evidence without provider access. Preflight
uses the Pages API token and a separate Cloudflare Access service identity to read
the current deployment, immutable build identity and ledger. Deploy preflight also
checks the public domain's identity and availability; recover preflight checks the
selected recovery target and works when the current frontend is unavailable.
It never uploads, rolls back, reserves a ledger entry or writes ledger status.
The receipt records `preflight-passed` and `ledgerWriteVerified=false`.

Configure `CLOUDFLARE_ACCESS_CLIENT_ID` and `CLOUDFLARE_ACCESS_CLIENT_SECRET` as
Actions secrets. The Access application's Service Auth policy must permit only
that service token for this project's protected deployment hosts. The reader sends
these headers only to validated HTTPS deployment hosts ending exactly in
`.schreiber-hub-preview.pages.dev`. It sends neither header to the public custom
domain or provider API, rejects redirects and rejects HTML login pages. Keep Access
protection enabled. The Pages API token alone does not authenticate Access requests.

After inspecting deployment-event consumers, run **Release ledger permission probe**
from current main. This is a GitHub metadata write, not a read-only check. It uses
the real Actions token with no Cloudflare secrets, creates a non-production,
transient record under environment `release-ledger-readiness` and task
`schreiber-ledger-probe`, then marks only that record inactive. It never writes the
production sequencing ledger. Retained receipts prove record/status write access;
they do not prove a live deployment or rollback. If status publication fails, use
the recorded ID to inspect the diagnostic record rather than assume no write occurred.

## Candidate build (no Cloudflare credentials)

After owner approval of the selected source and all five exact-main checks:

1. Run **Production candidate build** from current main with its full 40-character
   SHA. It uses the guarded independent builder and explicit repository variable
   `PRODUCTION_SUPABASE_ANON_KEY` for the fixed project acgqjjbrnkmeazswdnzp.
   No .env fallback, service-role key, automatic signup or email activation.
   This legacy anon key is public browser configuration; its claims are checked,
   but the builder does not cryptographically verify it or contact Supabase.
2. Inspect the candidate and copy the **release.json SHA256** from the run summary.
   That digest binds the ordered per-file SHA256 manifest, revision and provenance.
   It is not the Actions ZIP digest or the older dry-run tarball digest.
3. Record owner approval of that exact source/run/digest in the release contract.
   Retain the artifact securely beyond Actions' 90-day expiration before deployment.
   Candidate approval does not authorize a backend change.

## Forward upload

Run **Manual frontend upload or recovery**, operation `deploy`, mode `plan`, from
current main. Supply the candidate SHA, successful candidate run ID, approved
manifest digest and the exact current Cloudflare production deployment UUID.
Plan reads GitHub and validates the downloaded files, but never reads or writes
Cloudflare and does not establish live provider readiness.

Artifact selection requires a successful main-dispatch run of the specific candidate
workflow in this repository. The artifact is selected by its immutable ID after
validating the run, not downloaded from a PR or selected by a loose name. The
controller verifies every file hash and build-info, rejects links, unexpected files,
worker/functions/config files and non-deployable artifacts. Artifact contents are
never executed. The one exception is the approved Daily Schedule forwarding (below).

### Daily Schedule forwarding (#98)

The hub runs exactly one Pages Function: `functions/daily-schedule/[[path]].js`. It
passes every request on `/daily-schedule` and `/daily-schedule/*` unchanged to the
`daily-schedule` Worker through the service binding `DAILY_SCHEDULE`, and returns
the answer unchanged. It checks nothing; the Worker checks the hub sign-in itself.
`public/_routes.json` sends only those two patterns to Functions, so every other path
is served as static files and runs no function.

- The candidate build copies `functions/` into the artifact beside `frontend/`
  (`frontend/`, `functions/`, `release.json`), lists its hash under `functions` in
  release.json and writes `functions: <forwardingId>` into build-info.json.
- `scripts/release-policy.mjs` holds the approved SHA256 of both files (`forwarding`).
  The guard accepts the function, `_routes.json` (artifact root only) and the
  build-info marker only together and only with those exact hashes, or a fully
  static build with none of them. Any other function, a changed file, a link,
  `_worker.js`, any `wrangler.*` file or a routing file that sends more paths to
  Functions is refused. Changing either file needs a reviewed policy change.
- Upload copies the verified artifact's `functions/` (never the checkout's) into
  Wrangler's empty working directory. `wrangler pages deploy` compiles
  `./functions` from its working directory and uses the artifact's `_routes.json`
  instead of generating one. Wrangler excludes `_routes.json` and `functions`
  from the static assets it uploads.
- A deployment with `uses_functions: true` is accepted (current, recovery target,
  post-upload verification) only when its build-info names the approved
  `forwardingId`. A current deployment that is not identity-read during recovery is
  checked by ID only, as before.
- The binding itself is set once in the Pages project settings (Settings →
  Bindings → Service binding `DAILY_SCHEDULE` → Worker `daily-schedule`, Production)
  during the release ticket, before the upload; it is not in a committed file.
  Bindings apply to deployments made after they are set. Without it the function
  answers 503 "Daily Schedule is not connected."
- Local check against a stub Worker (no network, no account):
  `bun install --cwd tooling/release --frozen-lockfile --ignore-scripts` then
  `bun run check:forwarding`. A separate frozen Bun lock pins Wrangler 4.152.0 and its dependencies;
only that tool is installed in the upload job, without deployment credentials or
package lifecycle scripts. No application build/install receives the Cloudflare token.

A later, separately authorized `execute` dispatch additionally requires:

- `PRODUCTION_FRONTEND_ENABLED=true` repository variable (enabled with owner approval).
- `CLOUDFLARE_ACCOUNT_ID` variable and `CLOUDFLARE_PAGES_API_TOKEN` secret entered
  through secure provider/GitHub settings, never chat or source files.
- Exact confirmation `DEPLOY <full SHA>` and an HTTPS `recovery_reference` to
  reviewed durable recovery evidence. This URL is an operator attestation, not an
  automated proof that a backup exists or can be restored; verify that separately.

The controller requires the workflow revision and release source to match current
main, verifies main ancestry, reads the fixed Direct Upload project, requires
production branch main/custom domain and no Git integration, no Functions other than
the approved forwarding, and
compares Cloudflare's canonical deployment against the supplied previous UUID.
Current build identity must be clean, target the same backend and precede the new
source in Git history. Duplicate/backward forward uploads fail.

Immediately before upload, main and canonical deployment are read again. All manual
uploads, recovery and original dry-run builds share `production-frontend` concurrency.
A stale queued operation fails when its expected deployment no longer matches.
A persistent GitHub Deployments ledger also rejects old/repeated workflow run numbers,
including the case where recovery restored the original deployment UUID. The token
has deployments:write solely for this ledger; repository contents remain read-only.
A reservation is persisted before Cloudflare mutation, and the last main/provider
checks run after reservation. Ledger read/write failure prevents mutation. A reserved
run cannot be rerun to mutate: inspect state and dispatch a new approved run instead.
The ledger's run-number namespace is this workflow: do not delete/reset its history
or rename/recreate the workflow without an explicit state migration. Reading is
bounded at 1,000 records, after which an explicit ledger migration is required.
GitHub deployment events may notify integrations; inspect installed consumers before
activation. Consumers were inspected before probe 39845601264 and live release
39846752862 verified deployment/status writes. This implementation does not grant
environment review enforcement. Serialization alone is
not FIFO protection. Cloudflare offers no atomic comparison
and upload operation here: **pause out-of-band dashboard/CLI deployments during
execution**. An external actor can race the final check. This is a documented
operational boundary, not a claimed atomic lock across all Cloudflare clients.

Wrangler receives only the approved static folder and explicit project/main/commit
metadata in a clean temporary working directory, with a reduced environment. The
controller confirms the new canonical ID and unique run/digest marker, then checks
immutable and custom-domain build-info plus root/reset-password HTML responses.
These are availability/identity checks, not sign-in or feature acceptance.

## Native manual recovery

Run the same workflow with operation `recover`, first mode `plan`, supplying:

- Full source SHA expected in the previous deployment's build-info.
- Exact current production UUID and exact target production UUID.
- For separately authorized execution, `RECOVER <full SHA>` and durable recovery
  reference, plus the same activation/configuration gates.

Recovery uses Cloudflare's native rollback API, **not a rebuild or arbitrary artifact
upload**. It requires the target to be a successful static production deployment
with an immutable URL inside this Pages project. Preview deployments, Functions other
than the approved forwarding,
wrong/dirty backend identity and marked dry-run builds fail. Target source must
belong to main history. This supports the historical ea05047 independent deployment
without pretending it was built by the new candidate workflow. Legacy build-info
may omit deployable; explicit false is always rejected. The current frontend need
not respond for recovery: its provider ID is checked, while target identity must
still be readable before mutation. If the old deployment/identity is unavailable,
stop and use a separately reviewed artifact restoration procedure.

Rollback changes frontend delivery immediately and cannot reverse database, Edge,
Auth, Storage or email changes. Operator review of backend compatibility remains
necessary; matching the project ID alone cannot establish schema compatibility.

## Receipts, failures and access limits

Each plan writes receipt.json without a GitHub deployment mutation. Before a mutation it records previous ID, source,
artifact digest (deploy), target (recover), run and workflow revision. Execution first records `reserved` with its ledger ID. Outcome is then
`mutation-outcome-unknown` until a response identifies the deployment, then
`applied-unverified`, then `verified` only after live checks. Receipt artifacts are
retained for 90 days, including when a step fails. A runner termination can prevent
receipt upload: inspect provider state and run logs rather than assume no change.
There are three bounded observation attempts, no automatic mutation retries, and
no automatic rollback on smoke errors. Never rerun an uncertain upload blindly.

Manual dispatch and confirmation text are not independent enforced owner-review
gates. Repository writers can trigger Actions, and privileged maintainers can change
workflow code/settings. Branch protection remains plan-restricted; no environment
approval is claimed. Review access and credential scope before activation. Prefer
an account-restricted Pages Edit token; this may cover other projects in the account.
No visibility change or plan purchase is part of this work.

Official references: [Direct Upload with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/),
[Pages rollback behavior](https://developers.cloudflare.com/pages/configuration/rollbacks/),
[rollback API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/rollback/).
