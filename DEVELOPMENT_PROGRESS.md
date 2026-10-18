# Development progress

Updated: 2026-10-18. This is the current status record; update it after each meaningful
verification or change. A successful local check never marks a production step done.

## Current milestone

Branch policy: `main` is production and must not receive commits, merges, or pushes
from ongoing development. Feature work targets `develop`; production release needs
an explicit user instruction.

Foundation work is saved on `codex/local-development-foundation`, based on
`5a81add`. Local `develop` remains at `5a81add`; local main remains at `37284f0`.
On 2026-10-18 the user requested local checkpoint commits and a return to clean
main. Existing lockfile changes are preserved separately in `772e995`; lint cleanup
is in `e6b454d`; this infrastructure checkpoint contains the remaining foundation.
Switch back to the feature branch before resuming foundation work. These checkpoints
are not release approval: the last verification still has 53 lint errors / 30 warnings.
No push or merge is part of this operation. Neither new branch has been published;
GitHub branch protection remains unconfigured.

Complete the local backend foundation and reconcile it with an authoritative Cloud
schema. Current status: **partial local proof; not ready for staging or release**.

| Work item | Status | Evidence / next action |
| --- | --- | --- |
| Repository/build baseline | Verified locally | Build + TypeScript pass; lint now has 53 errors / 30 warnings |
| Isolated local Auth/database | Verified for limited scope | Synthetic accounts; API on 55321; `dev:local` |
| Time-off happy path and cross-user isolation | Verified locally | `npm run test:local`; prior manual browser submission |
| Targeted HR schema reconstruction | Verified locally; full parity pending | Supplied export incorporated; `local:audit-schema`: 60/60 tables and column names |
| Permission state transitions | Fixed and verified locally; NOT deployed | Forward migration `20261016210000`; permission + happy-path tests pass |
| External functions/Realtime | Not implemented locally | Explicitly disabled, not silently considered tested |
| Verification command and CI definition | Implemented and checked locally | `npm run verify`: 7 checks pass, lint fails; GitHub execution pending |
| Branch protection | Not configured | Required remote checks await first GitHub run and lint cleanup |
| Staging | Not established | Separate backend and integration credentials needed |
| Production release | Not started | All seven release steps below remain pending |

## Latest findings

- User supplied `schema_benefits_positions_timeoff.sql`, reporting a read-only catalog
  extraction at 2026-10-16 20:32:43 UTC and PostgreSQL 17.6. Original retained under
  `local/reference/`; SHA-256 recorded in `local/SCHEMA_RECONCILIATION.md`.
- Missing HR definitions restored through a local-only bootstrap before dependent
  migrations. The previous conditional trigger skips were removed. All 60 table
  names and column names now match client types; this is not complete live parity.
- HR API tests pass: admin writes, own-record reads, cross-user isolation, validation,
  generated compensation on insert/update, and audit records.
- Supplied time-off policies match the local defects. A new forward migration fixes
  pre-approved inserts and own cancellation, and prevents cancellation tampering.
  All local permission regressions and the admin-approval smoke test pass. Production
  has not been tested directly or changed; this migration still requires release review.
- Export has incomplete application-role grants and malformed generated-column syntax.
  Normalization and remaining parity limits are documented; no Cloud-only role was added.
- Existing plaintext shared-password account migration remains an audit finding;
  production credential validity has not been tested.

## Next actions, in order

1. Review the targeted reconstruction and forward permission migration. Obtain complete
   grants/default privileges and canonical generated-column metadata before declaring
   production parity; the current supplied export only lists `sandbox_exec` grants.
2. Review/push the drafted verification workflow in a feature PR and observe its first
   GitHub run. Fix the documented lint backlog before declaring the gate green.
3. Expand safe integration and browser coverage; Edge Functions/Realtime remain disabled.
4. Establish staging, then rehearse deployment/backup/recovery before any live release.

## Production release checklist

- [ ] Candidate validated in staging.
- [ ] Release commit recorded and backup/recovery path verified.
- [ ] Backward-compatible database changes applied to production.
- [ ] Compatible backend functions deployed.
- [ ] Frontend published.
- [ ] Login and changed workflow verified in production.
- [ ] Production errors and service health reviewed.

## Change log

- 2026-10-18 review correction: tightened the local smoke, permission, and HR
  tests. Authorization failures require SQLSTATE 42501; reversed dates require
  23514 and the time_off_dates_valid constraint; negative benefit values require
  P0001 and the specific validation message. RLS-filtered compensation updates
  must succeed with zero affected rows, not an arbitrary error. Service-account
  read-back confirms rejected inserts are absent and rejected updates preserve
  the entire row. Valid cancellation may change only status and updated_at.
  Attempted insert IDs are registered for cleanup before each write, including
  failure paths. All four verify:backend checks and targeted ESLint pass.
  Initial date-test expectation was corrected after checking the actual constraint;
  no schema or application behavior was changed. Main remains 37284f0; no push,
  merge, or deployment. The migration/infrastructure packaging review remains open.

- First lint cleanup batch: removed 75 errors (128 -> 53); 30 warnings remain.
  Replaced frontend caught `any` values with `unknown` and a checked error-message
  reader; preserved API/native error messages and workflow fallback text. Added
  eight regression cases for native/API errors and malformed thrown values.
  Removed redundant query-result casts, typed contact/submittal/attendee writes
  from generated schema types, and fixed props aliases, schedule declarations,
  and the Tailwind ESM import. The attendee lookup now follows its declared
  table-returning RPC shape (also confirmed in the SQL migration).
  Full local verification passes all seven non-lint checks (nine unit tests total);
  lint still fails with 53 errors / 30 warnings. Initial sandbox run could not access
  Docker; rerun with Docker access completed successfully apart from lint.
  Edge Function payloads, frontend JSON boundaries, generated preview auth timer,
  and hook/refresh warnings still require review. Generated Lovable files and
  Edge Functions were not changed in this batch. No rules were disabled.
  No commits, pushes, branch switches, merges, or production changes were made;
  main remains `37284f0`, develop and feature HEAD remain `5a81add`.

- Baseline synchronization: fetched origin and reviewed its two newer commits
  (preview auth storage and generated types). Fast-forwarded only the feature branch
  to `5a81add`; develop already matched. Preserved all uncommitted work and verified
  main stayed at `37284f0`. Incoming types also reference `email_queue_dispatch`;
  catalog inventory covers tables/columns only and does not certify function parity.
  Post-update verification: all seven non-lint checks pass; lint now has 128 errors
  and 30 warnings (one additional error in incoming previewAuthStorage.ts).

- Branch correction: discovered that previous work remained uncommitted on local
  main. Created/switched to the foundation feature branch and created local develop.
  No commits, merges or pushes occurred; main's commit was verified unchanged.

- First implementation: Docker local backend, synthetic seed, local-only migration
  exceptions, guarded local startup command, environment-aware upload/function URLs,
  API smoke test and browser submission. See `local/AUDIT.md` for detailed evidence.
- Follow-up: added repeatable schema inventory and permission regression commands;
  confirmed a third missing HR table and two permission defects. No production
  changes, commits, pushes, or remote configuration changes performed.

- Schema reconciliation: received user export; restored three HR tables, removed missing-
  table trigger guards, rebuilt disposable local data, and verified 60-table inventory.
  Added HR regression tests. Reproduced time-off defects before the forward fix; after
  local application, permission, happy-path, HR and inventory checks all pass.

- Verification gate: added `npm run verify` and app/backend/lint groups, .nvmrc,
  GitHub workflow definition, agent instructions and lint backlog. Combined local
  run: seven checks pass and lint fails as expected (127 errors, 30 warnings).
  A clean temporary npm install plus app type/unit/build checks also pass. Workflow
  YAML parsed locally; remote GitHub execution and branch protection are NOT done.

The package-lock.json changes predate this work; their contents were preserved
unchanged in a separate checkpoint commit on 2026-10-18.
