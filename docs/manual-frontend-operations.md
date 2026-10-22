# Manual frontend upload and recovery

Implementation is reviewable, not activated. No production credential/configuration
was added and no upload or rollback was performed to test it. All workflows are
manual, main-only, and require a separately approved main integration before use.
The prior dry-run build remains available and remains non-deployable.

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
never executed. A separate frozen Bun lock pins Wrangler 4.152.0 and its dependencies;
only that tool is installed in the upload job, without deployment credentials or
package lifecycle scripts. No application build/install receives the Cloudflare token.

A later, separately authorized `execute` dispatch additionally requires:

- `PRODUCTION_FRONTEND_ENABLED=true` repository variable (not configured by this PR).
- `CLOUDFLARE_ACCOUNT_ID` variable and `CLOUDFLARE_PAGES_API_TOKEN` secret entered
  through secure provider/GitHub settings, never chat or source files.
- Exact confirmation `DEPLOY <full SHA>` and an HTTPS `recovery_reference` to
  reviewed durable recovery evidence. This URL is an operator attestation, not an
  automated proof that a backup exists or can be restored; verify that separately.

The controller requires the workflow revision and release source to match current
main, verifies main ancestry, reads the fixed Direct Upload project, requires
production branch main/custom domain and no Git integration or Functions, and
compares Cloudflare's canonical deployment against the supplied previous UUID.
Current build identity must be clean, target the same backend and precede the new
source in Git history. Duplicate/backward forward uploads fail.

Immediately before upload, main and canonical deployment are read again. All manual
uploads, recovery and original dry-run builds share `production-frontend` concurrency.
A stale queued operation fails when its expected deployment no longer matches;
serialization alone is not FIFO protection. Cloudflare offers no atomic comparison
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
with an immutable URL inside this Pages project. Preview deployments, Functions,
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

Each plan writes receipt.json. Before a mutation it records previous ID, source,
artifact digest (deploy), target (recover), run and workflow revision. Outcome is
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
