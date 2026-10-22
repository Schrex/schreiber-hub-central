# Synthetic migration validation — 2026-10-19

> Historical migration record. For current production identity and operating rules,
> use [production baseline](production-baseline.md). Do not rerun migration steps
> or treat earlier pending-state descriptions as current status.

Status: local checks pass; independent real-data restoration remains unproved.
These results use only the existing `schreiber-local` Docker backend on
`http://127.0.0.1:55321`. `hub-rehearsal` is reserved for the separate restricted
real-data restoration. No hosted settings, credentials or data were accessed.

## Verified coverage

| Check | Result |
| --- | --- |
| Public signup | Unique fake account created through public signup, with linked profile and employee contact |
| Privilege forgery | Signup metadata claiming admin still produces only employee role; self-inserting admin role fails with authorization error and leaves roles unchanged |
| Login continuity | New account signs out and signs in with its synthetic password retaining the same user UUID |
| Private file positive access | Owner and admin download identical synthetic bytes and obtain working destination-local signed URLs, with matching SHA-256 |
| Private file negative access | Another employee and anonymous client cannot download or mint signed URLs for that object |
| Upload restrictions | Employee cannot upload into the foreman/office/admin-only safety-violation bucket; rejected object has no retrievable bytes |
| Existing schema inventory | 60/60 public table names and client column names match locally |
| Existing time-off API tests | Synthetic employee/admin login, pending creation, cross-user isolation, forged ownership rejection, date validation, approval/read-back pass |
| Existing permission regressions | Preapproval, decision forgery, self-approval and cancellation tampering denied; legitimate cancellation persists allowed changes |
| Existing HR tests | Admin benefit writes, own/cross-user reads, validation, generated compensation and audit entries pass |
| Existing browser test | Employee submits request, another employee cannot see it, admin approves, employee reads persisted approval; 1/1 passes |

New coverage lives in `scripts/local-auth-storage.mjs`; it uses the existing strict
loopback status guard and never takes a target URL from environment files or CLI.
The service role creates/removes synthetic fixtures and verifies persisted state;
access assertions use ordinary employee/admin/anonymous clients. Unique test users,
contacts and files are removed in `finally`. It does not reset existing local data.
Existing suites can leave synthetic notification/audit records as documented in the
local README. Parent integration adds `test:local:auth-storage` to the backend
verification group, so subsequent backend/CI runs include the new checks. The
existing four backend checks and the new script passed during this workstream.

## Commands and environment

Bun `1.3.14` and Node `26.8.2` match repository pins. Eight existing local containers
were running (DB, Studio, metadata, Storage, REST, mail capture, Auth and gateway).
No backend was started, stopped or reset. Docker/loopback access required the tool's
normal sandbox escalation; execution succeeded after approval review.

Executed successfully:

```sh
node --check scripts/local-auth-storage.mjs
node scripts/local-auth-storage.mjs
bun run verify:backend
bun run verify:browser
bunx --no-install eslint scripts/local-auth-storage.mjs
git diff --check
```

The new API test was rerun after adding positive signed-URL byte verification and
passed again. Browser execution reported non-failing stale Browserslist-data and
terminal color warnings; no dependency updates were made.

## Remaining limits

- The file test covers one deliberately restricted bucket, not all 15 bucket policy
  combinations, every upload workflow, or restored production files.
- Signup confirmations are disabled in this disposable local configuration. Actual
  confirmation/reset mail, MFA, Google OAuth, real account hashes and hosted Auth
  continuity remain untested. Signup testing here does not require enabling signup
  in a real-data rehearsal.
- Edge Functions and Realtime remain disabled locally. No external email, SMS, AI,
  speech, webhook or production delivery test was performed by this workstream.
- Schema inventory is not complete live schema/ACL/policy parity. The existing local
  bootstrap and unreleased time-off candidate still differ from production.
- No original export was read, imported or validated. Real-data restoration,
  scheduler-history exclusion, destination isolation and cutover are separate gates.
