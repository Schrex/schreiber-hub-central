# Independent restore plan — inspected backup, 2026-10-19

Scope: preparation only. No import, SQL execution, source changes, destination
changes, secret activation or paid infrastructure. Target is existing
`hub-rehearsal` (`acgqjjbrnkmeazswdnzp`), never source `bitogpfplcquovpdjprk`
or the synthetic local backend. This is not an executable import script.

## Verified private evidence

The original ZIP/custom archive remain unchanged outside git in
`/Users/sumanththota/Schrex/archive/database-2026-10-19`. Offline pg_restore was
used only to emit SQL/catalog text, without a database connection. Detailed schema,
COPY payloads, per-table counts/digests, file paths and review matrix are owner-only
under `inspection/`; none are committed or used as application test fixtures.

- All 60 public table-data sections decoded; application/audit tables retained.
- 25 Auth users, 25 identities, 25 nonempty password hashes. Identity user IDs and
  profile user_id references resolve to exported Auth users. This establishes hash
  presence, not successful password authentication or destination equivalence.
- All 23 storage objects match the earlier capture by exact bucket/path and size.
  All local file SHA-256 values still match the capture manifest. There are 16
  bucket records: application buckets plus generated export bucket; classify the
  export artifact separately and do not upload the backup into app storage.
- Eight queue/archive/dead-letter tables are present and empty in this snapshot.
  Preserve their definitions and business email logs; do not drop all log tables.
- One cron job is present and active in the source snapshot. Source execution
  history is present but was not decoded into the selected private data file.
- One Vault secret row exists. Eleven Auth sessions exist; MFA factor and WebAuthn
  credential tables are empty. Preserve all original evidence; old session/token
  behavior needs an explicit destination policy and managed-schema comparison.
- Selected private data SQL (public/Auth/storage/queues/Vault/migration records)
  is 699,158 bytes, not an estimate of the final indexed database size or capacity.

## Proposed restore selection

The private `restore-selection-review.json` assigns every one of 1,666 TOC entries
an initial action. It is explicitly NOT executable/approved; platform and executable
objects still require destination comparison. It must not be passed to pg_restore.

| Objects | Proposed treatment |
| --- | --- |
| Public business data, pay/business audit logs, suppression/unsubscribe state | Preserve every table and row; compare counts and canonical content before login/write tests |
| Public schema, constraints, indexes, policies, grants and sequences | Restore reviewed definitions; use target roles, retain original IDs and sequence positions; explicitly verify constraints/RLS/grants before client access |
| Auth users and identities | Preserve UUIDs, identity relationships and password hashes exactly; load compatible data into target-managed Auth tables, not source Auth DDL or migration versions |
| Other Auth state | Compare every table/column with target. Archive all; decide sessions/refresh/flow tokens separately to require fresh sign-in. Do not silently discard account/provider/MFA state |
| Storage buckets and objects | Recreate reviewed application bucket settings and upload actual bytes through Storage API; reconcile object ownership/content type/cache control. Do not blindly COPY object metadata or source storage migration versions |
| cron.job_run_details and its sequence state | Exclude source history data and history sequence position; destination history starts empty. Keep original archive and source untouched |
| cron.job | Retain configuration privately; create reviewed inactive target definition only after replacing source-specific calls. Do not replay active row |
| email_queue_dispatch / email_queue_wake and wake triggers | Defer installation/activation; they reference source endpoint, Vault and cron. Supply inert rehearsal adaptation before any queue writes |
| Queue/archive/dead-letter data | Preserve; prevent consumers and queue wake triggers from running |
| vault.secrets | Quarantine; do not activate source ciphertext or copy encryption keys by default. Supply independent destination secrets only when needed later |
| Platform event triggers, extension-owned objects, Realtime internals, platform migration tables | Compare with target-managed baseline; do not replay blindly. Rebuild application publication membership separately after review |
| App Auth/profile/audit/notification triggers | Review dependency/effect inventory; prevent execution during load so existing users do not generate duplicate profiles, logs or notifications. Restore approved business behavior only after baseline validation |

String-based hazard scans identified seven functions for focused review, including
the two network/scheduler functions above. This is triage, not proof that every
function or dynamic SQL path is harmless. The private schema dump omitted owners
and privileges for inspection; the original TOC retains them. Exact grant/owner
mapping and extension versions must be reviewed separately, not silently dropped.

## Ordered execution plan (not yet performed)

1. **Read-only destination preflight.** Recheck target project identity, readers,
   exact table/user/bucket counts, PostgreSQL/extensions, Auth/storage columns,
   constraints and current size. The earlier connection check succeeded but did
   not establish current schema compatibility. Use the user's privately supplied
   password at a hidden prompt; never put it in chat, command arguments or git.
2. **Finalize adaptations and access isolation.** Restrict public signup before real
   data, establish effective Data API/client isolation while schema/RLS load, verify
   no deployed workers/external schedules/hooks/SMTP can send real messages. Default
   Auth email capability is not a verified sink. DNS can remain pending. Confirm
   any synthetic destination records are absent; do not erase unknown records.
3. **Prepare exact import artifacts.** Select archive objects structurally; preserve
   all business data. Resolve every managed-schema conflict, role/grant mapping,
   extension dependency, source URL and executable effect. Create synthetic tests
   for the actual restore executor/adaptations before using real data. No raw full
   archive restore, automatic cleanup/drop, ignored errors or production seeds.
4. **Restore the restricted target.** Explicit target allowlist and verified TLS;
   stop on first error, use reviewed transaction boundaries. Establish inert schema,
   load preserved business/Auth data without mutation triggers, restore sequences
   and constraints/RLS/grants, then add only reviewed non-delivery triggers. Keep
   consumers/schedules inactive. Preserve failure evidence privately and do not
   blindly rerun a partially completed import.
5. **Restore files.** Upload 23 objects to original application bucket/path pairs;
   reconcile every upload and metadata adaptation. Include empty application buckets.
   Never expose the database export through application storage.
6. **Prove recovery.** Compare snapshot counts/content digests and UUID relationships,
   password-hash preservation, file bytes, constraints and permissions before any
   login changes state. Confirm empty destination scheduler history and inert jobs.
   Test owner-authorized existing-user login and ordinary-role file/RLS access;
   no employee messages or source password resets. Email reset test waits for DNS.

## Remaining prerequisites

The read-only destination catalog was captured: empty target and 344 managed
column types/generated classifications match. See the refreshed destination audit.
Next is destination isolation and remaining constraints/executable-object review. No further source export
is required for this preparation step. Still missing: full target constraint/enum/default comparison,
verified isolation configuration, finalized managed Auth/storage mapping, reviewed
inert function adaptations, and a tested restore executor. An independent restore
has not yet been demonstrated. Source storage and database capture were separate
snapshots; the verified file-set match does not imply production writes are frozen.

Supabase's [manual backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
requires special handling of managed schema customizations and restore-time triggers.
Its [Auth migration guidance](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)
supports preserving users and password hashes. These inform the plan but do not
certify this Lovable archive's compatibility or successful restore.
