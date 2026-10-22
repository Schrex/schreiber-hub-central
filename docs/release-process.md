# Release process

## Contract and authority

Feature branch → reviewed PR into develop → five checks and local synthetic
acceptance → explicitly approved release PR into main → manual release action.
The owner authorizes each release; automation executes it. Merging main never
deploys. There is no permanent staging environment. Preview URLs do not isolate
data. Routine acceptance uses only disposable local Supabase.

Each release PR must record this contract before owner approval:

- Full candidate SHA; after merge, record the resulting exact main SHA and its
  successful push Verification run. PR merge-ref checks alone do not qualify.
- App, backend, lint, Edge and browser results plus feature-specific local
  acceptance evidence and remaining limitations.
- Scope: frontend files, explicit backend project, and backend changes (normally
  none). Database, Edge, Auth, Storage and email changes need separate reviewed
  ordering, authorization and recovery. Never blindly push historical migrations.
- Owner's explicit release authorization, selected artifact SHA256 and workflow
  run; previous deployment ID and retained artifact/recovery reference.
- After an authorized upload: new deployment ID, live build-info revision,
  project, mode and dirty=false; root/deep-link availability and scoped acceptance.
  Availability checks alone do not establish feature correctness.

## Implemented build-only foundation

Verification runs on PRs and main/develop pushes, plus manual dispatch. Feature
pushes alone no longer duplicate PR checks. Documentation-only PRs deliberately
run all five groups: no path exclusions, skipped-check equivalents or waived lint.
Install, browser dependency and job timeouts fail closed. Chromium errors identify
infrastructure failure separately from acceptance failure; retries require diagnosis.

`Release build only` is dispatch-only and runs from main. The owner-authorized
PR #18 integrated it at `6db89ad573016bb9a83dca767f28c03b25682146`. All five
exact-main checks passed, and [manual run 39836824903](https://github.com/Schrex/schreiber-hub-central/actions/runs/39836824903)
produced a hash-verified non-deployable artifact. This proved the build-only path;
the original test-build workflow still never uploads. Select the full
40-character **current main tip**. The guard rejects older commits, branch names,
PR runs, fork evidence, missing/skipped jobs and unsuccessful latest runs.
It queries GitHub's Verification workflow for that exact main push, then builds a
clean checkout. Shared production-frontend concurrency serializes runs; GitHub
concurrency is not FIFO. This test-build workflow has no uploader, so cannot overwrite a release.

The workflow uses pinned action commits, Node from .nvmrc, Bun from package.json,
frozen dependencies, read-only contents/actions permissions and no persisted Git
credential. GitHub's token is passed only to the evidence step. No production
secret or Cloudflare token is needed. Source .env is ignored by the independent
builder. The fixed production project is acgqjjbrnkmeazswdnzp, but its anon JWT is
**synthetic with an invalid signature**. The resulting artifact is NOT deployable
and must never be uploaded. No production API request or login is part of this build.

The 14-day Actions artifact contains a tarball and release.json with SHA256,
revision, dirty state, backend, workflow revision and verification URL. Build-info
also marks deployable=false. This exercises packaging and provenance, not hosted
acceptance or recovery. Artifact expiry is not a durable release archive.
Local packaging validation requires a clean commit and `RELEASE_SHA=$(git rev-parse HEAD)
node scripts/release-dry-run.mjs`. It makes no hosted requests.

## Activation gates and secure configuration

Read-only inspection on October 22: Actions enabled, all actions allowed, SHA
pinning not required by repository settings, zero configured environments. The
main branch-protection API returned HTTP 403 with a plan restriction. Do not
claim enforced review/protection or change visibility/purchase a plan to bypass it.
[GitHub's environment rules](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
depend on plan and private/public visibility; environment availability alone does
not imply required reviewers. Manual dispatch is an intentional action by a writer,
not an enforced owner-only reviewer gate. Review who has write access before activation.

Upload/recovery implementation is now described in [manual frontend operations](manual-frontend-operations.md). It is not activated. Before production use, separately review/authorize:

1. A deployment job using a fixed, reviewed Wrangler version and the existing
   Direct Upload project `schreiber-hub-preview`; no new project is needed.
2. Account ID and project settings read-back, including production branch and custom
   domain. Supply the public destination legacy anon key through explicit reviewed
   configuration; never use service_role or let source .env select the backend.
3. A Cloudflare token entered directly in the provider/GitHub secure settings,
   never chat or tracked files. Use Account / Cloudflare Pages / Edit restricted
   to the intended account; document that this may cover other Pages projects in
   that account. Do not claim project-level isolation without verifying it.
4. A credential-bearing job that never executes PR/untrusted source and downloads
   only the exact approved immutable artifact from the trusted build run, verifies
   its SHA256/provenance and rejects dry-run artifacts. Grant credentials only to
   upload, not dependency installation/build. No automatic deploy on push/merge.
5. Recheck selected main tip immediately before upload, serialize upload/recovery
   in the same lane and compare a durable last-deployed source record to reject
   stale or duplicate forward releases. Concurrency alone cannot prevent an older
   queued run overwriting a newer deployment. Recovery is a separate explicit action.

[Cloudflare Direct Upload CI documentation](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
describes Wrangler and the account-scoped token. Pages and Access credentials are
now configured. PR #23 integrated authenticated preflight and the isolated ledger
probe into main. Probe 39845601264 confirmed Actions deployment/status writes with
an inactive non-production diagnostic record. Production activation and live upload
remain separate owner-authorized steps. See DEVELOPMENT_PROGRESS.md for current
candidate, provider and recovery evidence; mock tests alone are not readiness proof.

## Recovery preparation and current baseline

Main/develop reconciliation completed through PRs #14/#15; PR #16 retained essential
migration evidence. It did not redeploy. Last recorded live frontend is clean
`ea0504798c9985ea44ad32d674579b15ae6f0c66`, independent mode, project
`acgqjjbrnkmeazswdnzp`, deployment `82bbfce8-7a2f-412f-b3b4-62af659022ef`.
Recovery archive: `dist/schreiber-hub-preview-ea05047.zip`, SHA256
`6a2150347ca964d9fff6627915d07b410ebe9a287b8d6555ead6d8783ff6abf2`.
These are retained observations, not fresh live validation or durable remote backup.
See [hosting recovery](migration-hosting-recovery.md).

The original ZIP was not located. A clean rebuild of ea05047 is retained as a
clearly labelled replacement in the [private recovery draft release](https://github.com/Schrex/schreiber-hub-central/releases/tag/untagged-0a06433c5cabc53168ac).
Replacement ZIP SHA256 is
`49ed9bf4c279b520d59751fa24ddc383c89fc01c0b1982c5dea44b623a3a04fd`.
All nine publicly served static files match the live baseline; build-info has a
new timestamp, and header/redirect files are source-derived. The downloaded remote
copy passed ZIP integrity and all 12 file hashes. This is not recovery of the old
checksum or proof of a production restore. Native rollback uses the retained
Cloudflare deployment, not this rebuilt archive.

Manual recovery must select an exact previous immutable deployment/artifact,
validate its hash and backend compatibility, record owner authorization and current
previous deployment, then restore and verify live build-info and availability.
No automatic rollback on transient smoke failures in v1. Frontend recovery does
not undo database/Auth/Storage/Edge changes. Preserve a verified durable recovery
copy before the first automated production release.

Add Employee follows these foundations as a separate feature. Its profile-trigger
and service-role employee_contacts SELECT failures remain open. Onboarding, Google
and deferred integrations stay disabled; automatic application email stays OFF.
Business triggers may still notify real recipients, so synthetic testing stays local.
