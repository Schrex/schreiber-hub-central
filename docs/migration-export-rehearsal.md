# Private export and independent restore preparation

Status: database export requested, 2026-10-19 14:33 UTC. Lovable confirmed
“Database export started”; completion and download were initially pending; see capture milestone below. No restore or
infrastructure provisioning performed. Earlier preparation observations below
are historical. User approved Lovable Cloud storage/email delivery followed by
local archiving in `/Users/sumanththota/Schrex/archive` (created with mode 0700).
The local archive choice supersedes the unresolved archive-location gate below;
independent rehearsal target and restore proof remain unresolved.

## Database export captured — 2026-10-19

Rechecked authenticated Lovable Cloud storage and downloaded the completed export
from the private `database_export_19_10_26` bucket. The original ZIP and extracted
PostgreSQL custom archive are in `/Users/sumanththota/Schrex/archive/database-2026-10-19`
outside git (directory 0700, files 0600). ZIP integrity passes; archive size is
30,196,291 bytes. SHA-256 and the full catalog are recorded only in the private folder.

Read-only `pg_restore --list` using the existing local PostgreSQL tool succeeds:
1,666 catalog entries, 60 public table-data sections, 27 Auth table-data sections
including users and identities, and eight storage table-data sections. Two cron
data sections include execution history. Preserve the original; exclude destination
scheduler execution history during reviewed restore, leaving the source untouched.
These counts establish catalog presence, not row completeness, hash preservation,
or restore success. No SQL was executed or database restored; synthetic staging
was not loaded with real data. Next: privately inspect restore selection and schema,
reconcile counts and file metadata, then perform the restricted independent rehearsal.
DNS is still pending. No production configuration or data was changed.

## Storage capture completed — 2026-10-19

Private output: `/Users/sumanththota/Schrex/archive/storage-2026-10-19`.
All 15 application buckets inspected: seven populated, eight empty. Downloaded 23
objects totaling 66,632,006 bytes in ten ZIPs, all passing ZIP integrity checks.
Private manifest records SHA-256 per archive/object and original object prefixes;
`objects/` reconstructs the bucket/path tree. Detailed names and file contents remain
outside git. Live capture is not an atomic snapshot or restore proof. Full object
metadata and policies still need reconciliation with the database export. The
separate generated database-export bucket remained empty at the end of this step.

## Verified starting point

- Clean checkout initially on `codex/migration-audit-live-findings`, HEAD `528b424`,
  identical to draft PR #10's remote head `cursor/migration-audit-4b4b`.
- PR #10 is open/draft and targets `develop`. All five hosted checks pass at that
  head (Actions run 39265809535). This is code/synthetic verification, not recovery proof.
- Remote `main`: `5a81add`; remote/local `develop`: `936bef8`; local `main`:
  `37284f0`. PRs #7 and #8 are merged into develop. Develop is 21 commits ahead
  of remote main; historical production migrations are identical across them.
- Lovable access rechecked in the in-app browser: Schreiber Field Cloud overview
  and export confirmation are accessible. The confirmation was canceled before
  **Start export**. No new Lovable chat prompt was sent.
- Dashboard still shows 60 tables, 25 signups, 15 buckets and 23 functions;
  Advanced settings shows 5.66 GB used. File contents/counts were not recounted.

Read this with [the migration audit](migration-audit.md). Earlier live aggregate
counts are a baseline, not a snapshot manifest for a new export.

## Private destination: unresolved prerequisite

No company-controlled archive folder/bucket, authorized reader list, encryption-key
custodian, or restricted rehearsal project has been identified. These cannot be
inferred from an authenticated Lovable session. User input requested for the exact
existing location and owner. Do not download into this repository, its ignored
folders, shared Downloads, CI artifacts, chat attachments, or synthetic staging.

Proposed layout **within the selected private store**, not a provisioned location:

```text
schreiber-migration/<UTC-export-id>/
  original/       database archive and separately downloaded file archives
  inventory/      private table counts, object paths, metadata and SHA-256 manifest
  schema/         full private definitions and separately reviewed sanitized copies
  restore/        reviewed import selection, adaptations and restricted restore logs
  evidence/       validation results, timestamps, operator and acceptance record
```

Before export, the owner must identify the exact URI, operator/reader identities,
private ACLs, encryption at rest/in transit, recovery-key custody, and retention
policy. Verify a harmless test file can be written, read and checksummed there.
Use an existing restricted execution host with encrypted temporary storage for
inspection and restore. No real-data laptop database. Browser downloads need a
known protected landing path and a secure transfer route; moving them afterward
does not retroactively protect a shared landing folder. No paid provisioning is
authorized. Store secret values in the company's secret manager, separately from
the archive manifest; keep signed download URLs out of git and ordinary logs.

## Export procedure

### 1. Database and Auth

The verified UI path is **More → Cloud → Overview → Advanced settings → Export
project data / Export data → Database / Export → Start export**. The final dialog
says one request per 24 hours, with a temporary download link emailed on completion
and a copy saved in Cloud storage. Start only after the private destination and
landing path are ready; the export itself creates an artifact in source storage.

[Lovable's export documentation](https://docs.lovable.dev/features/advanced-settings#export-lovable-cloud-data)
says structure, data, accounts and password hashes are included; files, function
code, project secrets and provider settings are separate. Published limits are
15 GB source storage and 5 GB export size. Actual contents remain unverified.
If the export fails a limit, obtain a provider-supported filtered export; do not
purge source scheduler history to make it fit.

Preserve the original export unchanged with timestamp, byte size and SHA-256.
Inspect format and archive inventory on the restricted host without printing rows
or SQL bodies into this chat. A filename extension is not enough to select an
import command. For a PostgreSQL custom archive, inspect `pg_restore --list`
privately; for SQL/compressed SQL, review and split with a format-aware procedure.
Do not run an unreviewed full SQL script or strip COPY blocks with line matching.

Reconcile the archive against the live catalog: every application table and
sequence; Auth tables (including users, identities and any MFA state); storage
metadata; queue tables and required operational state; types, views, functions,
constraints, triggers, policies, grants/default privileges, extensions and
publication membership. Record missing or provider-managed objects explicitly.
Do not substitute a CSV of email addresses, the historical user seed, or the
partial HR schema extract for an Auth/database backup.

[Supabase's Auth migration guidance](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)
supports migration of Auth tables and password hashes. Use independent destination
signing keys and require fresh sign-in. Verify UUID/identity relationships and
hash preservation privately; report only aggregate pass/fail. Account passwords
are supplied by their owner during the rehearsal, never requested in chat.

### 2. Schema, configuration and scheduler selection

Extract a schema-only artifact from the same archive where possible, plus separate
scheduler configuration rows. Review raw function bodies and job commands as
sensitive: they may embed credentials. Sanitized documentation contains placeholders
and Vault names only; maintain a private mapping for destination replacements.

Destination import policy:

| Item | Policy |
| --- | --- |
| All business data, pay audit, celebration/email logs, suppression/unsubscribe records | Preserve; no blanket log/history exclusion |
| Auth users, identities and required Auth state | Preserve with platform compatibility review |
| Queue contents and dead letters | Preserve inertly; never drain during the rehearsal |
| `cron.job_run_details` data | Exclude from destination import; leave source untouched |
| Cron definitions and wake/dispatch functions/triggers | Preserve definitions privately; adapt and install disabled |
| Vault and embedded source credentials | Inventory privately; re-provision destination values securely, never activate source keys |
| Other extension/platform state | Inventory and classify explicitly; no silent omission |

A schema-only dump cannot capture cron configuration rows. A full database archive
may carry cron history even though the destination must exclude it. Retain the
original privately and create a separately reviewed restore selection. For custom
archives, omit the exact history TABLE DATA entry from a reviewed restore list;
review extension configuration data and executable statements too. Plain SQL needs
an equivalent structural transformation. Prove the selection against the actual
format before running it. No destination truncation is a substitute for a safe import.

Direct database access is **not established**. If needed for missing content, request
an existing authorized export-capable connection or provider-assisted export through
a secure channel. Do not reset a production database password, invent a connection
string, deploy an export function, or link this development checkout to production.
The [Supabase backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
is a reference for roles/schema/data ordering, managed-schema customizations and
Vault compatibility. Its generic commands are not yet a tested recipe for this
Lovable archive; in particular, encrypted state needs separate compatibility review.

### 3. Files

Use **More → Cloud → Storage**, open each of the 15 buckets, and select/download
all files across every folder/page. [Lovable Storage documentation](https://docs.lovable.dev/features/storage)
describes multi-file ZIP downloads and temporary signed downloads for private
buckets. Test archive path preservation before treating a bulk download as complete.
If UI pagination or nested-folder selection is incomplete, use an authorized
Storage API read credential on the restricted host, with recursive paginated listing.
That credential/access has not been established; do not make buckets public.

Keep bucket IDs and exact object paths. Record a private manifest with bucket,
path, owner metadata, content type, cache control, byte size, modification/version
information available, and a SHA-256 of the actual downloaded bytes. Preserve
bucket settings and policies, including empty buckets. The earlier 23 objects /
66,632,006 metadata bytes are comparison clues, not a required fixed count.
Record any generated database-export artifact separately so it is not mistaken
for an application file. Detect missing, changed and deleted objects with before/
after inventories; do not declare cross-service consistency while writers run.

### 4. Remaining platform settings

Capture Auth site URL/redirects, provider configuration, password policy, templates,
SMTP/hooks and MFA configuration through restricted administrative access. Compare
all 23 deployed functions and gateway settings to git, enumerate external schedules,
and record required secret names and their owners. Source secret values are not
needed in git or this chat. Obtain replacement integration credentials separately.
DNS ownership, mail sender and SWPPP routing are later functional/cutover gates;
they need not block archiving database and file bytes once archive access is ready.

## Independent restore proof (not yet executable)

1. Identify an existing company-owned restricted rehearsal target, PostgreSQL 17
   compatibility, extension/managed-schema versions, storage service and named
   operators. Separate it from synthetic staging, preview hosts and this laptop.
2. Before any import, verify outbound network restrictions and disabled schedules,
   webhooks, mail/AI/SMS workers and queue wake behavior. Copied source URLs or keys
   must not cause requests to production. Disabling cron alone is insufficient.
3. Review the archive-specific restore plan and destination identity. Restore
   platform-compatible schema, Auth and application data with triggers/side effects
   controlled, preserving UUIDs and foreign keys without regenerating profiles.
   Stop on errors; do not silently skip failed objects. Restore exact grants/RLS.
4. Recreate bucket definitions and copy bytes through the supported Storage service;
   reconcile metadata and ownership deliberately. Do not assume inserting
   `storage.objects` rows uploads files, or blindly combine copied metadata with
   API uploads. Rewrite only source-host absolute URLs in the destination.
5. Compare full catalog definitions, per-table counts, primary-key sets, sequences,
   foreign keys and deterministic content checksums to the archived snapshot.
   Compare every file's checksum/path and all empty buckets. Keep detailed evidence
   private. Live counts can drift and are not the restore baseline.
6. Confirm `cron.job_run_details` has zero rows and no schedules can run. Confirm
   preserved queue/duplicate-prevention/audit state. Source history stays intact.
7. Owner performs copied password-account login; verify UUID/role associations,
   private file access and denied cross-user access. Exercise any Google mapping
   separately; earlier identities were all email. Do not reset source passwords.
8. Measure export/transfer/import/verification durations and repeat from the same
   archive into another empty restricted target before declaring repeatability.
   Publish only aggregate results and private evidence references in this repo.

The initial read-only capture cannot prove an atomic database/Auth/files snapshot
across active writers. Record its time bounds and inconsistencies. A final consistent
copy or practice freeze requires separate production authorization under the audit's
freeze plan. No freeze, source scheduler change, paid infrastructure, production
merge, Lovable pause/removal or cancellation is part of this preparation.

## Access gates still open

| Gate | Needed from owner / provider |
| --- | --- |
| Private archive | Exact existing location, owner, ACLs, encryption/recovery and retention |
| Export delivery | Authorized mailbox or Cloud storage retrieval; protected download path |
| Complete archive | Actual export inspection; provider help if limits or missing schemas prevent completion |
| File export | All-bucket download access; API read access only if UI proves insufficient |
| Restricted restore | Existing destination and restricted execution host, administrative connection via secret manager |
| Auth proof | Authorized account owner for password login; configuration/MFA compatibility |
| Independent runtime | Deployed source/config, replacement secrets, external schedule and integration ownership |

Exit criterion: an independently restored copy with accepted private evidence for
schema, business data, Auth continuity and all file checksums, with empty scheduler
history and no outbound effects. This criterion has **not** been met.
