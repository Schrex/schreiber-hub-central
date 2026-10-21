# Restricted database baseline runner

Prepared 2026-10-19 for **hub-rehearsal only**, `acgqjjbrnkmeazswdnzp`.
This is the first database load, not a complete functional restore or production cutover.
The corrected operator retry reported **Baseline committed** in private run
`runner-1792441149159`. Independent content reconciliation is the next gate.
Earlier failed-attempt details below are historical; do not rerun the importer.

## Isolation applied

Authenticated dashboard confirms signup off, Email provider off (other providers
already off), and Data API disabled. Enabled the Postgres Send Email hook
`rehearsal_guard.block_email`, which returns a constant HTTP 403 error without
reading, storing or sending its input. SQL is in `scripts/rehearsal/block-email.sql`;
this is destination-only operational SQL, not a production migration. The function
is invoker-security, with execution limited to Auth admin and its database owner.
Supabase documents that [Send Email hooks replace built-in sending](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)
and [Postgres hook errors are not retried](https://supabase.com/docs/guides/auth/auth-hooks).
No new service, credential or paid infrastructure was created.

A fresh destination aggregate query confirms zero users/business tables/buckets/objects,
no scheduler/network/queue extensions, the expected constant 403 result, Auth admin
execution allowed and anonymous/authenticated execution denied.

Data API disabling does not switch off Storage, Auth or Realtime globally. The target
currently has no users/files/buckets/business tables; the runner leaves all application
triggers, client grants, storage policies and publication membership uninstalled.
It additionally revokes client/service-role access to imported public objects. No
old Auth sessions are imported and sign-in remains disabled. File restoration must
keep every bucket private during rehearsal, including source-public talk-media.
Do not deploy workers, connect previews, add credentials, invite users, or re-enable
API/Auth while importing. Administrative access remains available to the operator.
These are verified configuration controls, not an end-to-end email delivery test.

## Operator command (not yet run)

```sh
sh /Users/sumanththota/Schrex/code/schreiber-hub-central/scripts/rehearsal-import.sh
```

The script requires an interactive terminal. Its confirmation explicitly accepts
fresh sign-in: users/identities/password hashes are copied; sessions, refresh tokens,
AMR claims and one-time tokens remain in the untouched archive. No other durable
Auth factor/provider records have nonempty source data in this inspected snapshot.
The operator attests current dashboard isolation before entering the rehearsal
password at psql's hidden prompt. No password is saved or passed in arguments.

The builder verifies hardcoded SHA-256 fingerprints of the four reviewed private
SQL files and writes a new 0700 run directory with 0600 files in the approved archive.
SQL and result logs remain outside git. SQL errors shown in Terminal contain only
SQLSTATE codes, not row values/context. The result file is precreated with mode 0600. The client image is already
installed, runs read-only without extra capabilities, and mounts only the CA and run
directory. Connection target/pooler username are fixed; TLS verifies the hostname.

A single transaction fails on the first SQL error. Preflight refuses existing
business tables/views/sequences, users, identities, sessions, buckets/objects,
scheduler/network/queue extensions or a new-user trigger. It does not drop, truncate,
reset or overwrite unknown records. Loads public definitions, Auth accounts, all
60 business tables, then constraints/indexes/RLS. No mutation triggers run. Count
checks cover all 62 COPY sections; relationship/hash-presence/RLS checks run before
commit. Exact content/hash reconciliation after restore is still mandatory; counts
alone do not prove full content equivalence.

The helper never retries. Ordinary SQL errors roll back the transaction. A connection
failure around COMMIT has an unknown outcome: inspect privately using a read-only
connection, never assume rollback or run again blindly. PostgreSQL sequences can
have nontransactional behavior; selected business sequences are newly created in
this transaction, and managed Auth/session sequences are not restored.

## Deliberately separate follow-up

- Reconcile destination business/account contents and password hashes privately.
- Restore 15 application buckets and 23 files using Storage API, verifying bytes and
  adapted metadata. Do not upload the export bucket or expose public file URLs.
- Review/apply exact source grants and business triggers, managed customizations,
  queue definitions and inert scheduler adaptations. pgmq-dependent functions are
  currently definitions only and cannot be exercised until queues are prepared.
- Scheduler execution history remains empty because no cron extension/history is
  loaded. The source cron job/configuration is archived, not activated or lost.
- Review enabling tightly scoped login/file tests only after baseline reconciliation.
  A later email delivery test requires replacing the blocker with approved SMTP.

## Validation

23 synthetic Vitest inspection/selection/runner tests pass. Shell syntax and diff
whitespace checks pass. `python3 scripts/migration-runner-synthetic.py` reads only
schema metadata and uses synthetic rows in a fresh temporary local database. It
checks successful commit, complete rollback on a forced late error, refusal of a
nonempty rerun, denied client reads, and Auth-only mail-block execution. The temporary
database is removed even on failure; ordinary local staging is not reset. This is
not hosted privilege proof or a real-data restore. App/browser/Edge suites were not
rerun because no app or deployed Edge code changed.

## Retry correction

The initial account artifact orders identities before users, which violates the
existing managed Auth foreign key. The runner now reorders complete COPY blocks,
users first, after verifying the original file fingerprint. Whole-block hashes prove
that account payloads/password hashes remain byte-for-byte unchanged. The synthetic
integration test now reproduces the original error and tests the exact transformation
with linked identities. The failed hosted attempt left zero users/identities/public
tables; do not delete or reset anything before retrying the corrected helper.

The operator subsequently proved the reset password works through the read-only
login helper. The importer now uses the same direct psql container entrypoint,
removing shell/stream-redirection differences. Authentication errors previously
occurred before SQL execution; their exact input-handling cause is unproven.

## Step 1 after commit: private content reconciliation

Run `sh scripts/rehearsal-data-check.sh` from the repository, entering the database
password only at its hidden prompt. This performs a read-only capture into the approved
private archive, then compares 60 business and two account COPY sections against the
pinned source candidates. Whole-row hash multisets detect every field change, including
password hashes, without requiring stable physical row ordering. Generated columns
omitted by pg_dump, sequences, grants, files and executable behavior remain separate
checks. A mismatch blocks the next step; do not edit data to force a match.
