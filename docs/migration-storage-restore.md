# Private rehearsal file restore

Database comparison passed for all 62 COPY sections. Next operator command:

```sh
python3 /Users/sumanththota/Schrex/code/schreiber-hub-central/scripts/rehearsal-storage.py
```

Use hub-rehearsal `acgqjjbrnkmeazswdnzp` only. In its dashboard, Project Settings →
API Keys → legacy anon/service_role keys, privately copy the existing **service_role**
key. Do not put it in chat, a shell argument, an environment file or Git. The helper
accepts it only at a hidden interactive prompt and checks its project/role claims
before sending it to the fixed target; server authentication verifies the key.
No new key or expanded access is required. The database password is not a Storage key.

Confirm `COPY REHEARSAL FILES` only with signup, Email and Data API still disabled,
no workers deployed and no new storage policies. The helper creates 15 private
buckets, excluding the database-export bucket, and uploads the 23 original paths.
Even source-public talk-media stays private. Every local file is verified before
changes; every remote file is downloaded and compared by byte count/SHA-256. Exact
bucket/path sets are checked at completion. No signed/public URLs are created.

API errors expose HTTP codes only. Credentials, filenames and provider response
bodies are not printed. HTTPS uses normal certificate verification, disallows redirects
and does not inherit proxy settings. No remote cleanup, overwrites or automatic retry.
If interrupted, a subsequent run checks every existing file and refuses mismatches
before uploading anything missing. Private progress reports live in the storage
archive's `restore-*` directories. A report's `complete` means file bytes and private
bucket inventory pass, not that the application or authorization migration is complete.

All bucket size limits are capped at 50 MiB for rehearsal, including the source's
500 MiB job-plans setting. Largest captured object is 26,195,703 bytes. Source settings
remain in the archive for later review; no paid upgrade is provisioned.

Storage creates new internal IDs, versions, timestamps and ownership metadata.
Original owner IDs, user metadata, content metadata and bucket settings remain in the
private source snapshot. Content type/cache-control are supplied during upload;
metadata/ownership reconciliation and access-policy testing are separate gates before
client access. Supabase documents that [service-key uploads do not set an owner](https://supabase.com/docs/guides/storage/security/ownership).
Do not claim a complete metadata-preserving restore from this byte-copy step alone.

Validation: five mocked API tests pass; private source preflight passes all 23 files
and 15 application buckets. No live upload or remote checksum test has run yet.

## Verified result and remaining ownership gap — 2026-10-19

Private restore report confirms all 23 bytes/checksums and 15 private bucket inventories
passed. A subsequent read-only hosted query (`scripts/rehearsal/storage-metadata-check.sql`)
returns hashed paths/owners for private comparison. All object paths, sizes, MIME types,
cache-control values and empty custom metadata match. Both source and destination
bucket owners are empty. No destination storage policies have been installed.

13 source objects have owner/owner_id values missing on the destination; 10 are
ownerless in both. Original owner mappings remain in the private snapshot. None of
the 57 original storage policies reference owner fields, but functional permission
testing remains necessary and exact owner preservation remains unresolved.

Do not replay the storage dump or directly patch these fields as an assumed safe fix.
Supabase's [Storage schema guidance](https://supabase.com/docs/guides/storage/schema/design)
requires treating metadata as read-only and using Storage API mutations. A supported
ownership-preserving procedure must be validated before correcting the 13 owners.
No public access, policies, login or email was enabled during this check.
