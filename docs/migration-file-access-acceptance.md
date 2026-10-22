# File-access acceptance evidence

> Historical migration record. For current production identity and operating rules,
> use [production baseline](production-baseline.md). Do not rerun migration steps
> or treat earlier pending-state descriptions as current status.

Verified 2026-10-21. Destination: **schreiber-hub** (`acgqjjbrnkmeazswdnzp`).
Production/source, employee files and hosted role assignments were not changed.

## Verified on the hosted destination

Read-only pinned CLI queries with an explicit destination project ref passed:

- All 15 Storage buckets remain private, with their reviewed settings unchanged.
- Storage objects RLS remains enabled; all 57 original policies and the role-helper
  definition, owner and grants match the reviewed fingerprints.
- The reviewed accident-photo replacement policy remains installed exactly, bringing
  the total to 58 policies. It permits office/admin replacement of an exact existing
  path; it does not grant creation in another user's missing path.
- Private `talk-media` has authenticated-only SELECT, admin-only INSERT and UPDATE,
  and no DELETE policy. Its three policy definitions were inspected without reading
  file paths, contents or employee records.

Reproduce the exact installed-state guard by generating SQL with
`scripts/rehearsal-accident-photo-candidate.py` and using only its `verify.sql` file.
The generator also writes mutation files; **do not execute those for verification**.
The separate metadata audits are `local/migration-checks/storage-file-access-catalog.sql`
and `local/migration-checks/private-talk-media-catalog.sql`. Use pinned CLI 2.121.0,
`db query --linked --project-ref acgqjjbrnkmeazswdnzp --file <audit> --output json`.

## Verified through synthetic local HTTP

Both commands target only the fixed disposable loopback backend. Neither accepts a
hosted URL. Fresh runs passed, and fixture/policy cleanup passed:

| Command | Result | Coverage |
| --- | --- | --- |
| `node scripts/local-accident-photo-replacement.mjs` | 590/590 | 14 private buckets; employee, foreman, office, admin and anonymous; own/other paths; read/create/replace/delete; extra accident upsert/move boundaries |
| `node scripts/local-private-talk-media-acceptance.mjs` | 60/60 | Destination-equivalent private talk-media delta; same five roles and own/other paths; download, signed URL bytes, public URL denial, create, replace and delete denial |

The second command temporarily makes local talk-media private and changes its read
policy to authenticated-only. It restores the exact original Storage policy catalog
and all bucket metadata in `finally`. All test-owned files and users are removed.
Expected-denial assertions reject unexpected server errors; byte read-back confirms
that denied replacement/deletion did not alter a file. No credentials or signed URLs
are printed. A signed URL intentionally grants temporary bearer access to its holder.

These two suites cover all 15 bucket types locally, but they are not a single hosted
650-case acceptance run. The local baseline's talk-media bucket is public, so the
original 590-case suite explicitly excludes it.

## Remaining hosted acceptance gate

Hosted Storage HTTP behavior is still unverified under employee, foreman, office and
admin sessions. Catalog equality and local HTTP success do not prove the destination
Storage gateway, JWT role resolution or actual signed-download behavior.

Complete this using approved role-specific hosted sessions and a narrowly approved
fabricated-file set. Do not change employee roles or use real accident photos as
replacement fixtures. The remaining checks are:

1. Allowed download/signing and forbidden cross-owner access for each required role.
2. Office/admin replacement of an approved existing fabricated accident photo;
   ordinary employee/foreman replacement denial and other-owner new-path denial.
3. Signed private photo/document/media opening against the destination, public-path
   denial, and clean removal of only the approved temporary files.
4. Record HTTP status and content-integrity evidence without recording credentials,
   signed URLs or employee data.

No hosted users, files, relay, policy changes or automatic notifications were created
for this verification pass. Browser sessions were not impersonated or extracted.
