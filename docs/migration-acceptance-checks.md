# Independent restore acceptance

Prepared 2026-10-19. This is an acceptance plan, not a completed restore report.
The database export is unavailable to the operator; no real-data checks below have
run. Read alongside [the export runbook](migration-export-rehearsal.md) and
[the migration audit](migration-audit.md).

## Environment and evidence rules

- Synthetic development/staging contains fake accounts and records only. Signup
  testing may stay enabled there, per the user's instruction. Existing local test
  scripts and seeds must never target the real-data rehearsal.
- Real-data rehearsal target: `hub-rehearsal`, project
  `acgqjjbrnkmeazswdnzp`. Independently verify the connection against that project
  before every import. A database name such as `postgres` proves no project identity.
- Source project `bitogpfplcquovpdjprk` is never a restore target. No production
  writes, freezes, scheduler changes, password resets, or deletion are authorized.
- Private evidence belongs under `/Users/sumanththota/Schrex/archive`, outside git,
  CI artifacts, chat, screenshots and shared preview tools. Include only sanitized
  pass/fail summaries in repository updates. SQL definitions can contain secrets;
  even hashes, object paths and schema inventories remain private evidence.
- Record archive SHA-256, export/capture time bounds, destination project, operator,
  tool versions, restore-selection hash, start/end times, errors, approved
  adaptations, and evidence filenames. Restrict file permissions before capture.
- Status values are PASS, FAIL, BLOCKED and NOT RUN. Missing evidence is never PASS.
  A reviewer must accept each deliberate difference; do not silently normalize it.

## Before loading real data

| Check | Pass condition | Evidence |
| --- | --- | --- |
| Target and readers | Company-controlled rehearsal project; authorized operators only; no Lovable editor or branch previews connected | Dashboard/connection verification and reader review, kept private |
| Capacity and compatibility | Actual selected restore size fits; PostgreSQL major, extensions and Auth/storage managed-schema compatibility reviewed | Archive inventory, target catalog, size estimate; source allocation alone is insufficient |
| Account isolation | Public signup disabled before real-data import; test accounts removed through a reviewed destination-only plan | Settings and empty-target inventory |
| Side effects | All schedules, queue wake/dispatch triggers, external cron, DB webhooks, Auth hooks, SMTP, deployed workers and outbound integrations disabled or routed to a verified sink | Configuration review plus synthetic effect test; empty cron list alone does not pass |
| Credential isolation | Independent destination keys; no copied source API keys, Vault ciphertext or embedded credentials activated | Private configuration mapping; names only in git |
| Import review | Actual archive format reviewed; restore stops on errors; exact scheduler-history data excluded before import; original preserved unchanged | Reviewed object selection and its hash |

If controls are not available on the destination plan, stop before import and
choose an effective control or another restricted target. Do not treat unpublished
frontend URLs as access control. Read-only SQL transactions are not a network sandbox.

## Restoration checks

Use the archived snapshot as the comparison baseline, not historical counts or a
changing production database. Storage capture and database export occurred at
different times; reconcile additions, changes and deletions explicitly. An early
rehearsal can prove restoration while remaining insufficient for final cutover.

| Area | Required evidence and pass condition |
| --- | --- |
| Archive completeness | Inventory every application/required managed schema and classify every omitted provider-managed object. Confirm Auth data and hashes are actually present; a CSV of emails is insufficient. Check original archive checksum before/after inspection. |
| Tables and rows | Exact per-table counts, primary-key sets and deterministic content comparison match the snapshot for every included table. Counts alone cannot detect substituted rows. Compare tables without primary keys as complete multisets, retaining duplicate counts. No raw rows or digest details in the report. |
| Schema | Compare columns, types/enums, defaults/generated expressions, sequences, indexes, constraints/validation flags, views, functions/owners/security-definer/search-path settings and triggers. Inspect definitions privately. Explain all managed-object differences. Preserve intentional disabled execution as a documented rehearsal adaptation. |
| Sequences | Captured sequence state and ownership/default dependencies match the selected restore; next generated values cannot collide. Inspect without calling `nextval` during read-only acceptance. |
| ACL and RLS | Compare table/column/function grants, default privileges, owners, RLS flags and policy roles/commands/USING/WITH CHECK. All 60 historical public tables having RLS is a clue, not an authorization proof. Preserve the baseline; the time-off candidate fix requires separate review. |
| Auth continuity | UUID sets and exact compatible password hashes match privately; identities retain user links/provider identifiers; account status, MFA and required state classified. Use destination signing keys and fresh sign-in rather than carrying active sessions. Owner performs a password login without exposing password or tokens. Google mapping/MFA each need separate proof or an explicit unresolved gate. |
| Relationships | Auth identities, profiles, roles, contacts and business foreign keys retain associations. Zero new orphan relationships; existing source anomalies are recorded, not silently repaired. Compare complete key sets to catch missing-but-valid subsets. |
| Audit and delivery state | Preserve `pay_audit_log`, `celebration_log`, `email_send_log`, `email_send_state`, suppression/unsubscribe records, queues and dead letters. Compare snapshot content and counts privately; do not drain queues or broadly exclude tables named log/history. Preserve payroll recovery/retention requirements recorded in SECURITY.md and the audit. |
| Scheduler | `cron.job_run_details` has exactly zero destination rows. Cron definitions are retained privately/adapted but inactive; queue wake paths cannot re-arm dispatch. No source history is deleted. Missing extension/schema is a compatibility gap, not a successful zero-row check. |
| Files | Every application bucket including empty buckets exists with reviewed visibility, limits and policies. Exact bucket/path set, byte lengths and SHA-256 match the private archive after downloading from destination. Reconcile ownership/content type/cache control/version metadata; copying `storage.objects` rows alone is not file restoration. |
| File references | Private path references resolve; approved source-host absolute URL replacements apply only in the destination. Signed URLs use the new project; cross-user/anonymous access fails where required. The generated database-export artifact is classified separately from application files. |
| Realtime | Compare publication membership/replica identity; test authorized subscriptions and cross-user denial separately with synthetic records. The source baseline omits toolbox talk attendees; adding it is a separate behavior change. |
| Restore process | Zero unreviewed restore errors or skipped objects. Record durations, selected data size, resource usage and repeat restoration from the same archive into another empty restricted target before declaring repeatability. |

For deterministic comparisons, define column order, encoding, UTC/time formatting,
NULL representation, binary encoding and canonical JSON/numeric representation.
Sort by complete primary key or compare canonical row multisets. Keep digest
inputs/results private. Compare before login tests because login can update Auth
timestamps/session state. Record subsequent test mutations separately.

## Functional and negative checks

Run broad write/integration tests first against synthetic data with sink credentials.
For real-data rehearsal, use owner-authorized accounts and the minimum necessary
read paths. Do not send messages to employees, reset source passwords, or create
business transactions merely to prove import success.

| Actor | Expected result |
| --- | --- |
| Signed-out client | No private employee/pay/files exposed; no new signup after real-data load |
| Employee A | Own permitted records/files readable; Employee B's restricted records denied |
| Foreman | Only authorized pay/HR scope; no privilege escalation via client writes |
| Admin/office | Required audit/sensitive-contact access works only under applicable role |
| Unprivileged client | Direct sensitive-column reads and unauthorized sensitive RPC calls denied |
| All test actors | Browser network uses rehearsal backend only; no production upload host, preview session forwarding or outgoing real notifications |

Authorization checks must use ordinary client roles/JWTs. Passing as a database
owner or service-role key bypasses protections and does not establish RLS safety.
Use redacted result counts/statuses, not screenshots of employee data.

## Read-only SQL aids

`local/migration-checks/catalog-summary.sql` inventories selected catalog metadata.
`local/migration-checks/restored-aggregates.sql` checks a small set of core counts,
relationships and scheduler state. Neither is a complete comparator or a connection
guard. Neither runs automatically. Do not paste private outputs into chat.

An authorized operator must first verify the target and secure the output location,
then use a reviewed PostgreSQL client with fail-on-error and startup files disabled
(for psql: `-X -v ON_ERROR_STOP=1`). Supply connection secrets through a protected
mechanism, not shell history/arguments or repository files. These SQL aids open a
read-only repeatable-read transaction with timeouts and end with ROLLBACK. Missing
relations, insufficient privileges or timeout are BLOCKED/FAIL, never empty results.
They deliberately print no hashes, emails, object paths, queue payloads, job commands
or function bodies. Exact full-table comparison remains a separate implementation.

Preparation validation: whitespace check and a static statement/transaction guard
pass for both SQL files (only BEGIN/SET LOCAL/SELECT/ROLLBACK, read-only transaction
and timeouts present). PostgreSQL client/parser unavailable on the preparation host;
SQL has not been parser-validated or executed against any database. Catalog-version
and privilege compatibility remain unverified. No backend was started or reset.

## Acceptance record

Current result: **BLOCKED — database export unavailable; no restore performed.**

For each check retain `check_id`, status, expected/observed aggregate, private
evidence reference, UTC timestamp, operator and reviewer. Record exceptions with
reason and owner. Only accept independent recovery after every required check
passes or a clearly scoped compatibility exception is accepted. External delivery,
DNS/cutover, final snapshot consistency and production release remain separate gates.
