# Independent frontend and recovery runbook

> Historical migration record. For current production identity and operating rules,
> use [production baseline](production-baseline.md). Do not rerun migration steps
> or treat earlier pending-state descriptions as current status.

## Operating status — October 22, 2026

The cutover has occurred. Earlier preparation sections below are historical;
statements that production is a placeholder or the live hostname is still Lovable
must not be used as current instructions. See DEVELOPMENT_PROGRESS.md for the
consolidated acceptance evidence and remaining gaps. This is retained evidence,
not a new live provider audit.

- Frontend: https://app.schreiberexcavating.com, Cloudflare Pages direct-upload project
  schreiber-hub-preview. Production deployment: 82bbfce8-7a2f-412f-b3b4-62af659022ef.
- Deployed revision: ea0504798c9985ea44ad32d674579b15ae6f0c66, clean, independent mode.
  Retained ZIP: dist/schreiber-hub-preview-ea05047.zip; SHA256
  6a2150347ca964d9fff6627915d07b410ebe9a287b8d6555ead6d8783ff6abf2.
- Wix DNS: app CNAME to schreiber-hub-preview.pages.dev, TTL one hour. Apex/www and
  mail records were retained. Custom hostname Active/SSL, admin reload persistence
  and an existing contract PDF were verified on October 22.
- Production Supabase: acgqjjbrnkmeazswdnzp. Site URL is the custom hostname; its
  exact /reset-password redirect was saved, retaining previous allowed redirects.
- Lovable frontend/domain/project Git sync were retired. Source daily-celebrations
  job 4 was disabled, email_queue_wake_auth and email_queue_wake_transactional
  disabled, and email_queue_dispatch(), email_queue_wake(), and
  read_email_batch(text,integer,integer) execution restricted to postgres.
  Prior grants were postgres/anon/authenticated/service_role for dispatch and wake,
  postgres/service_role for read_email_batch, and no PUBLIC grant. Both triggers
  previously had enabled state O. Restoring any of these may send queued mail.
  Source database pause completion was not verified after the accepted request.

Retain original private exports and the prior frontend artifact. The October 19
DB/Storage archive integrity checks passed; a finalized destination recovery point,
independent backup copy and full isolated restore proof are not recorded complete.
Do not rerun the empty-target importer on production. Frontend rollback does not
undo database, Auth or file changes; DNS reversal alone cannot reconcile writes.
Recheck current provider state and preserve new data before any approved recovery.

Permanent staging has been deferred. A historical preview URL can still point at
the production backend; never use it for routine destructive or employee-data tests.
GitHub verification is configured; deployment automation is not yet implemented.
Application delivery remains OFF; Auth SMTP and unknown external callers are separate.

Prepared October 20, 2026. Local preparation only. No hosting account, Pages
project, DNS, hosted Auth setting, production deployment or cutover was changed.
The [completion plan](migration-completion-plan.md) remains the release gate.

## Build that cannot silently inherit the source backend

Use Node from `.nvmrc`, Bun 1.3.14 and `bun install --frozen-lockfile`.
From the repository, in a private Terminal:

```sh
python3 scripts/independent-build.py \
  --project acgqjjbrnkmeazswdnzp \
  --url https://acgqjjbrnkmeazswdnzp.supabase.co
```

The user selected this existing destination as the permanent backend for now on
October 20. Production cutover remains a separate approval. The prompt accepts its legacy anon key, passed through stdin to the
builder. Do not enter a service-role key, signing secret or Postmark token. The
guard rejects wrong-project/privileged/expired JWT claims, opaque keys, mismatched
URLs and the source project. It does not cryptographically verify the key;
authorized hosted acceptance must verify it works. The anon key is public client
configuration and necessarily appears in generated assets.

The builder disables Vite `.env` loading and source config plugins, strips inherited
environment variables except OS essentials, and supplies only the chosen client
configuration. It sets `VITE_INDEPENDENT_LAUNCH=true`, local/rehearsal false. The
launch controls disable deferred UI actions; backend authorization and deployment
allowlists are separate gates. Keep standalone builder aliases/plugins aligned
with the application when changing its build requirements.

Output is `dist/independent` (ignored by Git). Only that directory is an upload
candidate. The builder may replace that directory; it does not upload it. It adds
an SPA rewrite, conservative `Cache-Control: no-cache`, and `build-info.json` with
revision, dirty flag and destination ref, never the key. No-cache means revalidate,
not prohibit storage. Vite emits hashed assets; verify actual host cache headers
and avoid zone rules overriding HTML caching. Source maps are disabled. A dirty
build is useful locally but **not a release artifact**: final approval requires a
clean reviewed commit, rebuilt artifact, private checksum manifest and matching
deployment ID. Do not publish synthetic test builds.

Local checks:

```sh
node --test scripts/independent-build-test.mjs
```

These synthetic guards check rejection and environment isolation. A full synthetic
destination build checks compilation only, with no backend connection. Neither
proves hosted security, live key validity, backend independence, or workflow success.

## Restricted preview: operator gates, not performed setup

1. Record the company-owned hosting account, authorized operator and existing plan.
   Permanent-backend choice is confirmed. User reports GoDaddy access and a new
   Cloudflare account. User confirmed the current Lovable hostname as
   app.schreiberexcavating.com. Signed-in Cloudflare access is verified; two existing
   Workers and no app Pages project were listed. Zero Trust setup is still needed
   before Access-protected hosting. Cloudflare Pages is a recommendation;
   do not buy a plan or create hosting until authorized. Prefer an explicit artifact
   upload after review; no automatic main-branch release or implicit deploy-all.
2. Establish access protection **before uploading the real-backend build**. If the
   provider requires an initial deployment, use an inert page with no app/backend
   configuration. Configure a narrow named-tester allowlist. Test an unauthenticated
   browser and an excluded identity against the deployment hash hostname, branch
   alias, project `pages.dev` hostname and any custom preview hostname.
3. Preview Access defaults do not protect all hostnames. Explicitly verify each
   hostname above; obscurity/noindex is not access control. The preview uses restored
   real data, and Supabase authorization remains essential even behind Access.
4. After approval, upload the exact reviewed artifact to a preview deployment.
   Record deployment ID, full immutable URL, commit and local artifact hashes.
   Never place service-role, database, SMTP or API secrets in frontend build variables.
   Those belong only in authorized destination server configuration.
5. With separate authorized hosted configuration, add the exact preview
   `https://<approved-host>/reset-password` redirect. Record previous Site URL and
   redirect list privately before changes. Set Site URL to the selected independent
   host when approved; retain the working recovery-code template. Do not wildcard
   arbitrary preview hosts or remove existing working redirects prematurely. Public
   signup and deferred Google sign-in remain off.
6. From a second device, verify HTTPS, Access denial/allowance, direct refresh of
   `/auth`, `/forgot-password`, `/reset-password` and an authenticated job deep link.
   Check `build-info.json`, script/content types and HTML cache revalidation. An
   authorized tester completes login/code recovery, private PDF/photo access and
   permitted upload; inspect network calls for destination-only backend traffic.
   Source Storage URLs and Lovable runtime calls fail this gate. Do not record
   credentials or employee payloads in shared evidence.
7. Complete the six-workflow and role-boundary acceptance in the completion plan.
   Verify required notification enqueue/provider/inbox outcomes under controlled
   recipients. Keep delivery/scheduler off until the separately approved test/release
   step; a working preview is not production authorization.

Cloudflare reference behavior checked against official documentation:
[preview access](https://developers.cloudflare.com/pages/configuration/preview-deployments/),
[hostname Access limitations](https://developers.cloudflare.com/pages/platform/known-issues/),
[SPA rewrites](https://developers.cloudflare.com/pages/configuration/redirects/),
[response headers](https://developers.cloudflare.com/pages/configuration/headers/),
and [Vite environment isolation](https://vite.dev/config/shared-options#envdir).
Provider/account capabilities still require action-time verification.

## DNS and production cutover: approval required

Before approval, fill in: release commit/artifact/deployment ID; chosen backend;
hosting and DNS account/operator; backup custodian and private location; rollback
operator; acceptance results; dispatcher cadence/credential owner/off switch.
Any missing value blocks production cutover, not local preparation.

Capture the current `app.schreiberexcavating.com` record type/value/TTL/proxy state,
current working deployment and Auth configuration privately. Confirm DNS ownership
and scope. Preserve apex/www, MX, SPF, DKIM and DMARC records; no nameserver transfer
or blanket zone replacement is part of this plan. Add the hostname to the Pages
project using its custom-domain flow, then change only the approved app record when
cutover is authorized. A bare CNAME without Pages association can fail; follow the
[custom domain procedure](https://developers.cloudflare.com/pages/configuration/custom-domains/).
If an Access-protected custom hostname cannot be attached directly, resolve the
provider restriction on an inert deployment first; never briefly expose the real
preview just to bypass the restriction.

At explicit production approval, announce a short no-dual-writes window through
the authorized operator, record the last source/destination reconciliation, verify
backup readability, then activate only the reviewed build/domain and approved
dispatcher. Test DNS/HTTPS from a second network, build version, login, jobs, file
access and one controlled required notification. Stop for wrong backend, auth or
authorization failures, missing records/files, or failing essential writes/mail.

## Recovery point and rollback

Before cutover retain, outside Git with restricted access, the original archive,
final destination database/Auth backup, private Storage bytes plus object manifest
and hashes, function source/config versions, grants/policies, Auth/SMTP configuration,
secret-manager references, frontend artifact/checksums, prior deployment, and DNS
snapshot. Database dumps alone are not Storage-byte or server-secret backups.
Record tool versions and the exact restore sequence already proven by the migration
runbook. Verify archives decrypt/read and manifests match now; record the private
location, custodian and check time without publishing payloads/password hashes.

Recovery rehearsal requires a separately authorized isolated target: restore schema,
data/Auth, then Storage bytes/metadata/policies and server configuration; keep mail,
scheduled work and public access disabled; verify counts/relationships/files and
synthetic/approved login. Do not test restore over source or current destination.
Readable archives alone do not prove a full working restore. Resolve any unproven
step before claiming recoverability.

Rollback operator procedure:

1. Pause access/writes and disable the dispatcher/delivery using the recorded off
   switch. Preserve the failed deployment, logs and new destination changes privately.
2. **No destination writes since cutover:** verify that fact, restore the recorded
   frontend deployment/DNS and necessary Auth redirects, wait for DNS caches, and
   confirm source login/essential reads before reopening. Do not assume DNS rollback
   alone makes an incompatible frontend/backend pair safe.
3. **Any destination writes:** keep both sides closed to writes; snapshot the current
   destination first. Identify changed records/files/relationships since the cutover
   baseline and reconcile them with an approved plan before reopening source. Do not
   replay external mail blindly or overwrite new work with the old archive. Prefer a
   reviewed fix forward when safer; document operator, decision and validation.
4. Confirm exactly one writable system, correct domain/backend and required workflow
   results. Resume the approved dispatcher only after checking pending recipients.
   Retain the originals and rollback access for roughly one week of observation.
   Lovable cancellation needs its own later explicit approval.

## Evidence versus outstanding gates

Verified locally: destination guard tests and a synthetic independent production
bundle compile; no hosted operation is involved. Existing source `.env` was neither
edited nor used by this builder. The synthetic client key cannot authenticate.

Unverified: hosting ownership/plan, protected preview, actual destination client-key
acceptance, DNS/HTTPS, host recovery, six live workflows, full finalized restore,
final release pinning, production approval and post-cutover operation. The existing
hub-rehearsal backend and Cloudflare Pages remain recommendations until confirmed.
