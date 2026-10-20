# Development progress

Updated: 2026-10-20. This is the current status record; update it after each meaningful
verification or change. A successful local check never marks a production step done.

## Migration checkpoint review and first hosted job read — 2026-10-20

Organized pending work into restore tooling/candidates, rehearsal frontend, and
verification/status documentation. Ignored Python caches. Pattern scan of pending
text found no embedded JWTs, private keys, bcrypt hashes or database COPY payloads;
the sole non-example email occurrence is the configured SMTP sender, not an employee
fixture. This is a focused review, not a comprehensive security certification.

Fresh checks: app typecheck, 19 tests and build pass; all six synthetic backend groups
pass; lint has zero errors and 30 existing warnings; Edge checker passes; synthetic
browser time-off acceptance passes. Five focused Python tests pass, along with
new Python/shell/JavaScript syntax checks. Initial sandbox Docker denial required
rerunning backend/browser with local access. The earlier 558/560 broader Storage
HTTP result remains unresolved and was not silently counted as passing.

Read-only hosted browser acceptance now directly confirms the signed-in profile,
seven job-list entries and one populated job detail. Its plan/photo sections are
empty, so this does NOT prove file downloads. Captured browser warnings contained
only React Router future flags, no errors. No job values/employee records copied to
Git, no role modifications, and no application write workflow was exercised.
Remaining next gate: an existing file read from a populated job/allowed bucket,
then authorized role-boundary acceptance; independent integrations and final cutover
remain pending. Admin-feature development stays paused.

## Current milestone summary — 2026-10-20

User supplied successful rehearsal password-update output and reported successful
login and their name loading after frontend restart. These are user-observed hosted
Auth/profile successes, not agent-verified complete browser acceptance. User reports
Zachary Schreiber holds the admin role; no role changes were made and the current
user's missing Admin menu is not by itself a migration defect.

Current controlled acceptance state: Email/password provider and Data API enabled;
public schema already exposed (earlier contrary reading corrected below). Public
signup remains off; email blocker and worker/scheduler isolation were not changed.
Historical instructions below requiring Email/Data API OFF describe earlier phases.
Baseline business/Auth and file restoration verified; complete independent app
operation, hosted authorization/file workflows, integrations, Realtime/scheduler,
fresh cutover snapshot and rollback remain pending. Production cutover is not done.

Git review: codex/export-capture at ef62984 tracks origin/cursor/migration-audit-4b4b
with 0/0 divergence against the locally stored remote ref. Live GitHub PR #10 is
OPEN/DRAFT targeting develop. At inspection, eight tracked files were modified and
51 files untracked (including two Python cache files); nothing staged. These
uncommitted changes are not included in the PR. No commit, push or merge performed.

## Data API enabled; schema reading corrected — 2026-10-20

User reported successful restored-account password recovery and login. With explicit
confirmation, enabled Data API only on hub-rehearsal; dashboard showed saved success.
Visual inspection confirms public is the one saved exposed schema. The earlier
claim that only graphql_public was selected was incorrect: the accessibility
"selected" marker represents menu focus, while a separate visual checkmark marks
the saved schema. An attempted public toggle was discarded with Cancel; no schema
change was saved. The saved public checkmark was then visually confirmed.
Dashboard reports 0/61 tables and 0/35 functions exposed; automatic exposure of new
tables is OFF. No schema selections, grants or policies were changed.
The signed-in frontend shows fallback Employee/There, not verified profile/admin
data. Next is a frontend refresh and actual client profile/role error inspection,
not another schema activation. Browser security policy rejected acquisition of
the localhost app tab during follow-up; no workaround was attempted. User refresh
and observed result are pending. Do not bulk-grant tables/functions
or expose rehearsal_guard. Signup and email-blocking settings were unchanged.

## Owner access and invitation-flow inspection — 2026-10-20

Existing AdminUsers page manages roles and profiles.is_active. Its Active toggle
only writes the profile flag; useAuth does not inspect that flag, and this path
does not call an Auth ban/session-revocation API. Do not describe it as verified
login revocation. create-employee and convert-employee-contact currently create
accounts with administrator-supplied passwords, not email invitations.

Prepared scripts/rehearsal-account-recovery.py for private operator use: lookup-only
by default, explicit --apply plus repeated account email and hidden password
confirmation for a password-only update. Fixed rehearsal project, service-role
claim guard, exact unique existing confirmed-account lookup; never creates accounts,
confirms email, grants roles, or changes isolation settings. Uses the installed
Supabase SDK and private stdin to the child process, without credential files.
Key guards reject four unsafe/malformed cases; Python parsing and embedded Node
syntax pass. No hosted recovery executed or successful owner login claimed.
An applied recovery intentionally changes one restored password hash, so subsequent
backup comparisons must account for that authorized divergence.

Pending: operator recovery/login; verify existing owner admin role; controlled
Data API activation; invitation acceptance/password setup and recovery flow;
server-enforced account deactivation/session handling. Signup stays off.

## Rehearsal password login enabled — 2026-10-20

With explicit user confirmation, enabled only the Email provider on hub-rehearsal
acgqjjbrnkmeazswdnzp. Dashboard save succeeded and provider displays ENABLED;
signup, anonymous sign-in and manual linking remain OFF, Confirm email remains ON,
and Google remains OFF. Data API was verified disabled immediately before this
change and was not modified. Existing rehearsal Send Email hook was not modified.
This permits eligible restored accounts to attempt password login project-wide.
Actual successful login and client database reads are still unverified. Production
was not changed. Historical isolation instructions requiring Email OFF now describe
the earlier import phase, not the current approved login-test state.

## Separate rehearsal frontend prepared — 2026-10-20

Subsequent read-only dashboard review on 2026-10-20: signup, manual linking,
anonymous sign-in and all listed providers (including Email/Google) are OFF;
Confirm email is ON. Send Email hook is ENABLED in rehearsal_guard (function
field redacted by browser observation, so its exact current name was not
reverified). Data API is OFF; its schema settings are unavailable while disabled.
No settings changed. Archived independent Storage evidence still exists and reports
57 policies, 15 buckets, zero public buckets and objects RLS enabled; this was an
evidence review, not a fresh live policy comparison. Enabling Email and Data API
would affect eligible restored accounts project-wide, not just the local browser.

Added `bun run dev:rehearsal`: hidden Terminal legacy-anon-key prompt, fixed
hub-rehearsal project, loopback port 8083, strict port binding, pinned Node version,
explicit environment overrides and rehearsal mode. No key file or source `.env`
change. JWT claim validation rejects wrong-project and service-role keys; signature
validation remains Supabase's responsibility. Rehearsal Auth UI disables the Lovable
Google broker and signup; these UI restrictions do not replace backend controls.

Two synthetic launcher tests pass, including six rejected key variants and source
environment override checks. verify:app passes typecheck, 19 tests and build;
verify:lint passes with existing 30 warnings. No hosted settings changed.
Actual launcher startup with the user's client key and hosted password login/API
acceptance remain pending. Existing hosted isolation must be reviewed before enabling
controlled access. Real-data rehearsal remains separate from synthetic local tests.

## App/database connection checks — 2026-10-20

Current default .env URL still points to the original source project, not hub-rehearsal.
Only the configured hostname was inspected; credentials were not printed or changed.
Ran Bun 1.3.14 verify:backend: all six groups pass (60-table/client-column inventory,
Auth/API time-off workflow, negative permissions, HR calculations/audit, job Storage,
foreman/office boundaries). verify:browser passes its employee/admin time-off workflow
against the fixed synthetic local backend. No production runtime used.

A fresh read-only query through the hub-rehearsal dashboard succeeds as postgres:
60 public tables, 70 enabled business triggers and 15 private buckets. This proves
dashboard database connectivity, not direct laptop pooler access or ordinary-client
Auth/PostgREST connectivity. Full frontend-to-rehearsal login/read/write remains untested;
default app configuration is not switched. Next is an explicitly isolated rehearsal
frontend configuration plus controlled authorized-account acceptance, keeping existing
production configuration separate. No hosted access controls changed in this check.

## Parallel remaining-work acceptance review — 2026-10-20

Three agents categorized remaining work and tested synthetic local Auth, actual Storage
HTTP, and current application checks. Full status: docs/migration-readiness-report.md.
Auth SQL integration passed six new-user variants, exact duplicate-email rejection and
forced downstream atomic rollback; original functions/ACLs/triggers restored. This does
not prove hosted Auth installation, password/session/provider/email behavior.

Storage HTTP acceptance: 558/560 pass across 14 private local buckets, five roles,
own/other paths and four operations. Office/admin updates to another user's accident
photo return 403; original bytes remain intact and same-role own-path controls pass.
These two gaps remain failures (script exits 2). Talk-media omitted because local source
bucket is public while target is private. All tracked objects/users/contacts cleaned up;
policies and bucket flags unchanged. No routine synthetic tests touched real-data rehearsal.

Current verify:app passes TypeScript, 19 tests and local-configured build; verify:lint
passes with zero errors/30 warnings; verify:edge passes 15 configured entry points after
an approved dependency-access retry. Not every deployed function is covered. Safety
media still renders stored/public URLs incompatible with the private target; current
Google broker and email worker still depend on Lovable. Some integration preparation
docs describe helpers/tests absent from this checkout; integration evidence must be
located before counting them complete. Hosted role/workflow/file checks, Realtime,
independent integrations, scheduler reconstruction and cutover/rollback remain pending.
No hosted changes, production changes or new activation performed in this review.

## Storage policies installed and independently verified — 2026-10-19

Operator run storage-policies-run-1792461454596344000 reports PASS. Fresh read-only
hosted capture exactly matches all 57 reviewed policy names, table, roles, commands,
permissiveness, USING and WITH CHECK expressions, compared with PostgreSQL-parsed
candidate SQL on a temporary local table under matching rendering search_path.
All policies target authenticated; all 15 buckets remain private; Storage objects RLS
is enabled. Independent evidence: behavior-review/hosted-storage-policies-postcheck.json
in the private archive. Local comparison rolled back. No file bytes changed.

This establishes policy installation, not hosted Storage API download/upload/denial
acceptance. Keep login/Email/Data API/workers OFF; no fresh dashboard switch inspection
in this check. Do not rerun the Storage policy installer. Next: controlled hosted file
authorization checks and managed Auth new-user setup before full application testing.

## Private Storage policies reviewed and installer tested — 2026-10-19

Prepared scripts/rehearsal/storage-policies.sql: 57 source policies across 15 buckets,
with the sole deliberate change narrowing public talk-media SELECT to authenticated.
Other 56 policies preserve source semantics. All buckets remain private. Policies use
role checks and, for personal files, the leading user-ID path segment (not owner fields).
local-storage-policy-matrix.py passed 600 synthetic role/bucket/path-ownership/operation
cases as anon/employee/foreman/office/admin, with denied mutations preserving metadata.
This uses a temporary RLS metadata table, not Storage HTTP/byte acceptance.

Prepared rehearsal-storage-policies.sh with fixed target/TLS, private output, pinned
policy artifact, role-helper checks, no-existing-policy guard, database isolation checks
and 57 authenticated-policy postcheck. local-storage-policy-install.py passed exact
core installation/postcheck as local postgres against managed storage.objects; repeat
and tamper rejected, original policy/bucket flags restored by rollback. Hosted read-only
authority check: RLS true, zero policies/public buckets; storage.objects owned by
supabase_storage_admin and postgres has no inherited owner/SET-role privilege. This
alone does not prove CREATE POLICY is denied; local managed-table installation passed.
Actual hosted installation capability remains to be established by the guarded run.

No hosted policies installed yet. Operator must keep login/Email/Data API/workers OFF;
after installation independently compare policies and run controlled Storage API tests
before considering file authorization complete. Production and file bytes untouched.

## All 70 business triggers enabled and independently verified — 2026-10-19

Operator run remaining-triggers-run-1792461135177794000 reports PASS. Fresh read-only
hosted catalog comparison confirms all 70 exact reviewed post-fix definitions are
ordinary-enabled. Both changed function fingerprints/security/permissions match the
prior verified capture. No Auth trigger, public bucket, Storage policy or outbound
pg_cron/pg_net/pgmq extension. Private evidence: behavior-review/hosted-all-triggers-postcheck.json.
No rows changed by verification. Dashboard login/Email/Data API/workers were not freshly
inspected; keep OFF. Do not rerun any completed activation installers.

Business-trigger restoration is complete at the catalog level, not full application
acceptance. Next: reviewed Storage access policies; then managed Auth new-user setup,
controlled hosted role/workflow/file checks and remaining integration/Realtime tests
before cutover. Production remains untouched and scheduler history remains separate.

## Remaining 14-trigger activation prepared — 2026-10-19

Prepared rehearsal-remaining-triggers.sh and pinned builder. Checks all 70 exact
reviewed definitions/states against the private post-fix capture, table ownership/RLS,
remaining function bodies/security/owners and notification/seeding dependencies,
database isolation and conflicting active job templates. Enables only the remaining
14; postcheck requires all 70 ordinary-enabled with unchanged definitions. Fixed target,
verified TLS, private output and single transaction; no business row rewrites or access
enablement. Login, Email, Data API and workers must remain OFF at operator attestation.

local-remaining-triggers-activation.py passed the exact activation core/postcheck after
building prior rehearsal state inside a synthetic rollback transaction. Repeat run,
helper security drift and changed pinned evidence are rejected. Function/ACL/trigger
fingerprints restored. Shell/Python syntax and whitespace pass. Hosted environment
guards are not simulated locally; concurrent seeding/full hosted workflows remain
uncertified. Operator execution and independent hosted verification are next.

## Behavior fixes installed and independently verified — 2026-10-19

Operator run behavior-fixes-run-1792460866947015000 reports PASS, including the guarded
template conflict check. Fresh hosted read-only capture matches both candidate function
bodies, postgres ownership, SECURITY DEFINER/search_path and denied anon/authenticated
direct EXECUTE. The exact replacement contact trigger definition matches and is disabled.
Other 69 trigger definitions/states match the prior verified capture. Total remains
56 enabled/14 disabled. No Auth trigger, public bucket, Storage policy or outbound
pg_cron/pg_net/pgmq extension. Evidence: behavior-review/hosted-behavior-fixes-postcheck.json
in private archive. No business rows changed during verification. Keep dashboard access/
email controls OFF; they were not freshly inspected. Do not rerun this installer.
Next: guarded activation of the 14 reviewed remaining business triggers, with separate
hosted state verification. Full hosted workflow/RLS/Realtime acceptance remains pending.

## Guarded behavior-fix installer ready — 2026-10-19

Prepared rehearsal-behavior-fixes.sh with fixed rehearsal target/TLS, hidden password,
single transaction and private evidence. SHA-256 pins all three candidates and source
trigger inventory; checks exact 56-enabled/14-disabled state, original function bodies/
security/owners and original contact trigger. Checks active job-template conflicts under
a table lock, without printing template values. Conflicting payloads stop installation.
Postchecks preserve function ACLs and 56/14 trigger state and confirm candidate bodies
and the disabled replacement contact trigger. No row rewrites or access activation.

local-behavior-fixes-install.py passes exact core installation/postchecks in a rollback
transaction. Repeat, security drift, conflicting templates and tampered candidate are
rejected. Function/security/ACL and trigger fingerprints restored. Hosted environment
guards are not simulated locally; operator must attest signup/Email/Data API/workers OFF.
No hosted installation yet. Next: operator execution then independent comparison before
enabling any of the 14 held triggers. Candidate files remain outside production history.

## Remaining behavior fixes prepared and tested — 2026-10-19

Prepared three unapplied candidates under local/candidate-migrations:
20261019233000_safety_notification_recipient_dedup.sql,
20261020001000_contact_sync_effective_changes.sql, and
20261020001100_job_contact_seed_duplicates.sql. No hosted changes or promotion.

Notification candidate excludes already-notified active Presidents from the admin
loop. The --candidate notification suite first reproduces source duplication, then
passes 45 recipient/gating/payload cases including overlapping roles/date boundaries.
Contact sync candidate watches effective name/email/link changes after normalization
and leaves its replacement trigger disabled. Job seeding collapses identical templates,
rejects conflicting template payloads atomically rather than discarding them, and uses
job/template locks. Baseline and --candidate sync/setup suites pass corrected stale
profile/duplicate cases, conflict rollback, missing-job rejection and cleanup. Function,
ACL and trigger fingerprints restored; no real business rows used or rewritten.

Preserve structured contact-name authority and profile-controlled account status.
Frontend evidence: EmployeeContacts saves both structured/display name and email;
AdminUsers controls profiles.is_active. These are preserved semantics, not mandatory
migration defects. Concurrent seeding and full hosted/RLS acceptance remain untested.
All 14 remaining hosted triggers stay disabled. Next: guarded isolated installation
of candidates, source-template conflict assessment, then independent verification
and staged activation. No production release or access enablement authorized here.

## Pay-audit activation independently verified — 2026-10-19

Operator run pay-audit-run-1792460454323002000 reports PASS. Fresh read-only hosted
catalog confirms exact source table/name/function/state inventory: 48 timestamps,
five validations and three pay-audit triggers enabled; 14 remaining triggers disabled.
No Auth trigger, public bucket, Storage policy or pg_cron/pg_net/pgmq extension exists.
Private evidence: behavior-review/hosted-pay-audit-postcheck.json. No business rows
changed during verification. Dashboard login/email/API switches were not freshly
inspected; keep OFF. Do not rerun audit activation. Remaining groups are four sync,
one job-contact setup and nine notification triggers, held for source-behavior findings
documented in docs/migration-trigger-groups.md. Full hosted acceptance remains pending.

## Pay-audit activation prepared — 2026-10-19

Prepared rehearsal-pay-audit.sh and pinned builder. Fixed isolated target/TLS, hidden
password, single transaction and private output follow the prior runners. Checks exact
70-trigger starting identities/states, source audit function body/SECURITY DEFINER/
owner/search_path and all three AFTER INSERT/UPDATE/DELETE bindings. Postcheck expects
48 timestamp, five validation and three audit triggers enabled; 14 remain disabled.
No rows, login settings, Storage policies, schedules or workers are changed by activation.

local-pay-audit-activation.py passes exact core/postcheck and rejects incorrect prior
state, repeat activation, altered security/event definition and changed artifact.
Rollback restores local trigger fingerprint. Pay-audit behavior suite rerun passes
nine payload/actor cases, nine audit failure atomicity cases and three NULL-actor cases.
Shell/Python syntax and whitespace pass. Hosted isolation preflight remains mandatory
and is not simulated by local activation test. No hosted activation yet; operator run
and independent verification next. Other groups remain held for behavior review.

## Remaining trigger groups reviewed in parallel — 2026-10-19

Three agents tested all 17 remaining business triggers on synthetic local data only:
three pay-audit; four contact/profile sync plus one job-contact setup; nine notification.
See docs/migration-trigger-groups.md for the complete 70-trigger classification,
commands, limitations and findings. Tests serialize shared local mutations using one
advisory transaction lock, disable outbound hooks as needed, and roll back fixtures.

Pay audit passed nine full payload/actor cases, nine audit-failure atomicity cases and
three NULL-actor cases. Notification suite passed 41 characterization cases. Sync/setup
suite passed its source-parity and rollback checks but reproduced behavior gaps:
normalized contact fields can leave profiles stale; structured contact names override
profile name edits; contact active status does not reverse-sync; duplicate active job
contact templates create duplicate slots. President+admin receives duplicate safety
notifications. These findings are not fixes or hosted acceptance. Actual template
rows were not scanned to determine whether duplicate source data exists.

All 17 remain disabled in rehearsal; no hosted writes or activation scripts produced
by this parallel work. Pay-audit activation is the next independent preparation step.
Hold sync/setup and review notification duplicate behavior before activation. Preserve
source behavior unless a separate fix is reviewed; production remains untouched.

## Validation triggers activated and independently verified — 2026-10-19

Operator run validation-run-1792460076136413000 reports PASS. Fresh hosted read-only
catalog capture independently matches every source trigger table/name/function/state:
48 timestamps and five validations enabled, remaining 17 disabled. No Auth trigger,
public bucket, Storage policy or pg_cron/pg_net/pgmq extension exists. Evidence stored
privately as behavior-review/hosted-validation-postcheck.json. No business rows changed
by verification. Dashboard access/email switches were not freshly inspected; keep OFF.
Do not rerun validation activation. Next: synthetic tests for the three pay-audit
triggers, including caller attribution and INSERT/UPDATE/DELETE audit contents, before
preparing their isolated activation. Hosted application acceptance remains incomplete.

## Validation activation runner prepared — 2026-10-19

Prepared scripts/rehearsal-validation.sh with fixed rehearsal pooler/TLS, hidden
password, single transaction and private output. Builder pins the source trigger
artifact and four validation function bodies/security/owner settings, checks all 70
trigger identities and starting states, and verifies the five target event definitions.
Only five validation triggers activate; exact postcheck expects 48 timestamp plus
five validation triggers enabled and the remaining 17 disabled. Existing source
duplicate compensation bindings are preserved. No row writes or access changes.

local-validation-activation.py passes the exact activation core/postcheck in a local
rollback transaction. Wrong initial state, repeat activation, changed function security,
changed trigger event and altered source artifact all reject. Local trigger fingerprint
restored. Validation behavior suite rerun passes all 20 rejection cases. Shell syntax
and whitespace checks pass. Hosted environment guard is not simulated locally; operator
execution must attest dashboard isolation and passes database isolation guards before
activation. No hosted activation yet; independent catalog verification required after run.

## Validation trigger synthetic tests passed — 2026-10-19

scripts/local-validation-triggers.py verified four local function bodies/security settings
against the private source schema and exercised all five exported trigger bindings on
synthetic temporary tables as authenticated. Source has two compensation triggers
calling the same function; both were preserved and tested together, not deduplicated.
Valid zero values, equal dates, open-ended benefits/positions, compensation year boundaries
and recalculation on INSERT/UPDATE pass. Twenty invalid INSERT/UPDATE cases reject with
exact P0001/message checks: negative compensation components/pay/benefits, invalid years,
and reversed dates. Whole-row sets remain unchanged after each rejected operation.
All temporary objects/data rolled back; original trigger-state fingerprint unchanged.

This isolates validation logic from actual-table constraints, RLS and other triggers;
it does not certify full hosted workflows. No hosted triggers activated. Next: prepare
guarded activation for these five, followed by independent hosted verification. Existing
48 timestamp triggers remain the only enabled business group; keep client access OFF.

## Timestamp triggers activated and independently verified — 2026-10-19

Operator run timestamps-run-1792459051094898000 reports PASS. Fresh hosted read-only
catalog capture confirms the exact 48 source timestamp triggers are ordinary-enabled
and the exact other 22 business triggers remain disabled, comparing table/name/function
and state against the reviewed source inventory. No Auth trigger, public bucket,
Storage policy or pg_cron/pg_net/pgmq extension exists. Evidence saved privately as
behavior-review/hosted-timestamps-postcheck.json. No business rows were changed by
verification. Do not rerun the timestamp installer. Dashboard access/email switches
were not freshly inspected; keep them OFF. Next group: validation triggers, with
synthetic valid/invalid input checks before isolated rehearsal activation.

## Timestamp trigger activation prepared and locally tested — 2026-10-19

Classified the 70 business triggers: 48 timestamp updates; five validation triggers;
three pay-audit triggers; four contact/profile synchronization triggers; one job-contact
setup trigger; nine notification triggers. Auth user creation remains a separate step.

Prepared scripts/rehearsal-timestamps.sh and its pinned builder for only the 48 timestamp
triggers. It checks exact source inventory, timestamp function body/security/owner,
trigger event/timing/function/arguments, RLS/ownership, 70 initially disabled triggers,
and database isolation. It enables no login, API, Storage policy, worker or scheduler.
A successful run must leave exactly 48 ordinary enabled and 22 disabled triggers.

The rollback-only local-timestamp-activation.py test installs the exact source inventory
inside a transaction (local has additional development triggers), exercises the same
activation core/postcheck, and checks disabled-versus-enabled timestamp behavior as
an authenticated role on a synthetic temporary table. Changed artifact and repeated
activation are rejected. Original local trigger fingerprint restored after rollback.
Hosted environment preflight is not simulated by this test. No hosted activation yet;
operator hidden-password execution and independent catalog verification remain next.
Remaining validation/audit/sync/setup/notification behavior is not certified by this test.

## Rehearsal grants installed and independently verified — 2026-10-19

Operator run grants-run-1792458524042331000 committed successfully. A fresh read-only
hosted catalog capture independently matches all 305 individual ACL entries against
the pinned reviewed draft plus attendance helper: no missing or extra grants, no grant
options, no PUBLIC/anon grants. Authenticated schema USAGE and five function EXECUTE
permissions match; table/column permissions match exactly. Sensitive SSN and attendee
access-token SELECT remain denied. Private evidence: behavior-review/hosted-grants-postcheck.json.

All 60 public tables retain RLS; all 70 business triggers remain disabled. No Auth
trigger, Storage policies, public buckets, or pg_cron/pg_net/pgmq extensions exist.
Installer result log also reports PASS. Do not rerun the grant installer. This read-only
check did not freshly inspect dashboard signup/Email/Data API switches or deployed
workers; the operator attested isolation at installation. Keep these controls OFF.
Next: review and test trigger activation in controlled groups, then restore reviewed
Storage access and complete hosted behavior tests before any client access. This is
verified permission restoration, not a completed migration or production cutover.

## Isolated rehearsal grant installer prepared — 2026-10-19

Prepared rehearsal-grants.sh and pinned SQL builder: 118 reviewed table/column grants,
authenticated schema USAGE, five reviewed function EXECUTE permissions. Removes prior
PUBLIC/anon/authenticated table, column, sequence and function privileges first so
defaults cannot mask restrictions. No service-role/default privilege expansion or
Storage policy activation. Sensitive-contact compatibility RPC remains included as
tested, restricted by its office/admin checks. Login/Data API/email/workers must stay off;
this is permission preparation, not permission to use the app with disabled triggers.

Fixed rehearsal pooler/TLS, hidden password, single transaction and private evidence.
Guards check isolation, 70 disabled triggers, no Auth sessions/trigger, table ownership/
RLS, attendance fix and exact five function body/security/owner settings. Postchecks
cover function allowlist, sensitive columns, no table-management permissions and anon
denial. Draft fingerprint pinned; repeat execution rejected while schema access exists.

Exact installer grant changes/postchecks pass the rollback-only four-role matrix with
attendance candidate. Original ACL/trigger/policy fingerprint restored, fixtures absent.
Tampered artifact and already-enabled local preflight tests fail as intended. Full
hosted preflight remains pending operator execution; dashboard isolation settings must
be confirmed at operator prompt (not freshly inspected in this step). No hosted grants
applied. Next: operator installation and independent catalog verification before any
trigger activation or client access.

## Attendance candidate installed; duplicate attempt safely rejected — 2026-10-19

Private run attendance-run-1792457686807740000 reports success. Subsequent run
attendance-run-1792457789041624000 stopped at preflight with P0001 because the helper
already exists. No retry or cleanup needed. Fresh hosted read-only checks confirm the
updated session policy and exact candidate helper body fingerprint, SQL language,
boolean return, STABLE/SECURITY DEFINER, postgres ownership and pg_catalog search_path.
Authenticated EXECUTE is present; anon/PUBLIC EXECUTE absent. Client schema USAGE
remains absent for anon/authenticated; all 70 business triggers remain disabled and
Auth trigger count remains zero. Table ownership/RLS checks pass. Evidence saved
privately. Do not rerun the attendance installer. No production change performed.

This confirms isolated candidate installation, not full hosted application behavior.
Next remains reviewed permission activation and controlled hosted testing.

## Attendance candidate rehearsal installer prepared — 2026-10-19

Reviewed the helper's fixed caller identity, fully qualified table/auth references,
pg_catalog search_path, postgres ownership and restricted EXECUTE. Prepared
rehearsal-attendance.sh with fixed hub-rehearsal connection, certificate verification,
hidden operator password and single transaction. Candidate content is SHA-256 pinned;
preflight checks exact original policy fingerprint/role/command, both table owners/RLS,
70 disabled business triggers, absent Auth trigger/helper and closed client schema access.
Postchecks verify helper security/permissions, changed policy and continuing isolation.
No broad grants, activation, rows, schedules or Auth trigger are changed.

Complete installer preflight/candidate/postcheck passed against a transactionally
simulated local isolated state as postgres, followed by rollback. Changed candidate
content rejected; shell syntax and whitespace pass. Candidate's four-role permission
tests passed in preceding milestone. No hosted installation performed; operator
execution and independent hosted verification remain pending. Candidate stays outside
production migration history and is authorized here only for isolated rehearsal.

## Attendance recursion fix validated as separate candidate — 2026-10-19

Added local/candidate-migrations/20261019220000_attendance_policy_recursion.sql.
Only the session participation SELECT policy changes: it calls a narrowly scoped
SECURITY DEFINER boolean helper instead of recursively querying attendee RLS. Helper
uses auth.uid() (no caller-supplied identity), fully qualified objects, pg_catalog
search_path, postgres ownership and authenticated-only EXECUTE. Existing foreman,
office/admin and attendee write policies remain unchanged. New helper adds one EXECUTE
grant to the prior proposal (five total); existing token RPC behavior is unchanged.

Rollback-only combined grant test with --candidate passes all four roles, including
exact attendance visibility, session access, own-attendance updates, foreman/admin
attendance insert/delete, denied employee/office insert/delete, office update denial,
uninvited employee read/write denial, anonymous denial and prior sensitive-data/token
boundaries. Original version still reproduces 42P17 for all four roles (exit 2);
candidate exits 0. ACL/trigger/policy fingerprints restored and all synthetic users
absent after each run. No persistent local policy change or hosted change applied.

Candidate remains outside supabase/migrations and is not part of applied production
history. It resolves the reproduced loop in local tests, not full app acceptance.
Hosted application remains isolated; candidate release review and explicit promotion
authorization are still required. Private archive is required for this targeted harness.

## Combined grant proposal tested; attendee policy blocker — 2026-10-19

Reviewed frontend RPC calls and policy dependencies. Combined private commented-only
proposal has 118 approved table/column statements, one authenticated schema USAGE,
and four EXECUTE grants: has_role, list_employee_directory, get_attendee_by_token,
and get_employee_contact_sensitive. The last is source compatibility for office/admin;
no current frontend call was found, so it is optional pending scope review. All four
function bodies match the export. Their application helper dependency is has_role;
local policy catalog uses only that public helper. No public sequences exist, so no
sequence grants are needed. get_primary_role, trigger/internal/queue functions, anon,
service_role and default grants are excluded. Source broad defaults are not replayed.

`scripts/local-grant-proposal.py` tests the combination in one local rollback-only
transaction. It first disables non-internal public/Auth/pgmq triggers and constructs
five synthetic users explicitly, then revokes existing table AND column permissions
and PUBLIC/anon/authenticated function access before applying the proposal. This avoids
inherited local privileges masking missing grants. No hosted writes or real rows used.

Targeted employee/foreman/office/admin checks pass: job reads; plan insert/delete for
foreman/office/admin and denied employee insert; cross-user compensation hidden from
non-admins; directory address redaction; sensitive-contact RPC denied to employee and
foreman, allowed for office/admin; assigned attendee token visible only to its user;
invalid token empty; sensitive-column privileges absent; self-promotion denied to
non-admins; TRUNCATE/TRIGGER/REFERENCES/MAINTAIN/schema CREATE absent. Anonymous table
and RPC calls are denied; internal function execution remains denied. Unassigned
attendee tokens remain usable by any authenticated holder, explicitly existing behavior,
not newly approved access policy.

**Activation blocked:** SELECT id FROM toolbox_talk_attendees fails with SQLSTATE
42P17 (infinite RLS recursion) for all four roles. All ten attendee/session policies
match the source export exactly after whitespace normalization. The harness reports
this failure and exits 2 after cleanup; it does not waive or fix it. Narrowed grants
cannot repair the recursive policies. This is a source-definition problem reproduced
locally, not a test of production runtime. Two existing local time-off policies still
differ from source due to the unreleased candidate; they were not changed or certified.

Exact original public ACL and non-internal trigger fingerprint restored after rollback;
all five test users absent. Private commented combined draft saved under behavior-review.
No rehearsal access, triggers, workers, schedules or production settings activated.
Next: review a separate fix for the attendee/session policy recursion and decide whether
the optional sensitive-contact compatibility RPC belongs in initial activation scope.

## Access review and synthetic foreman/office boundaries — 2026-10-19

Added test:local:roles to backend verification. Temporary synthetic foreman and office
accounts both pass job-plans/job-photos upload/delete, employee read-back, denial of
another employee's compensation, and denied self-promotion to admin with service-role
verification. Files, compensation/audit fixture and temporary accounts/contacts cleaned
up. Initial fixture year 2097 was rejected by the existing validation rule; rerun using
the current year passed. Targeted ESLint and whitespace pass.

Source/local comparison finds 251 public policies each, 249 exact matches after
whitespace normalization. Only the two known time-off insert/cancel policies differ;
local uses the unreleased candidate fix. Do not silently promote that behavior change
or claim local time-off tests certify source permissions. All 57 Storage policies
previously matched. No hosted access changes performed.

Reviewed 118 authenticated table/column grant statements. 59 grant ALL at table level;
two more explicitly include management privileges. Prepared private commented-only
review reducing these to SELECT/INSERT/UPDATE/DELETE while retaining column-level
restrictions. No table-management privileges, anon, sandbox_exec, default, function,
schema or sequence grants are included in that draft. This is a proposed narrowing,
not applied permissions or a complete activation script. Frontend RPC call sites found
for list_employee_directory and get_attendee_by_token; their execution grants and
indirect policy helpers require review before any access activation.

Next: complete function/schema/sequence grant review and test the combined proposed
permission set locally; keep hosted triggers disabled and API/login/email isolated.

## Disabled business triggers installed and independently verified — 2026-10-19

Operator completed the installer. Latest private run log reports success. Fresh hosted
read-only catalog query confirms exactly 70 public triggers; all definitions match the
reviewed candidate after whitespace/schema-prefix normalization and every trigger is
disabled. Referenced function schemas independently confirmed public; PostgreSQL
omits that prefix when visible in the inspection session search path.
Auth trigger count remains zero; pg_cron/pg_net/pgmq remain absent; Storage policies
and public bucket counts remain zero. Independent evidence saved privately in
behavior-review/hosted-trigger-postcheck.json. Do not rerun the installer.

No trigger activation, client grants or application access enabled in this step.
Next ordered milestone is access-grant review and testing before any hosted activation.
Full runtime behavior, indirect dependencies and account-trigger activation remain open.

## Hosted trigger functions verified; disabled installer ready — 2026-10-19

Read-only hosted comparison passes all 20 functions directly referenced by the 70
public triggers: exact body fingerprints, SECURITY DEFINER flags, public search_path,
plpgsql language, trigger return type and postgres ownership. Hash-only query and
aggregate result saved privately. This is definition parity, not runtime validation
of every indirect dependency or permission path.

Prepared rehearsal-triggers.sh and pinned private SQL builder. Fixed rehearsal pooler
and verified TLS; hidden password through direct psql; single transaction, lock and
statement timeouts. Refuses altered artifacts, existing business/Auth triggers,
outbound extensions, unexpected table ownership/RLS, public buckets or Storage policies.
Rechecks function fingerprints in the transaction; installs only 70 public triggers and
asserts all disabled. No Auth trigger, grants, data writes or activation included.
Evidence remains private; failures require reconciliation before retry.

Validation: artifact tampering rejected; existing-trigger preflight rejects synthetic
local execution and rolls back. The 70 definitions previously passed a local postgres
rollback-only installation test. Shell syntax and whitespace pass. Hosted installation
NOT performed; operator password entry required. Next: independent catalog check after
operator execution, then access-grant review. Concurrent Postmark documentation retained.

## Postmark Auth SMTP delivery verified in isolated test project — 2026-10-19

User added Postmark DKIM and Return-Path records for mail.schrex.com; both were
verified in the authenticated Postmark UI. User completed account approval; UI
confirms approved/live. User created isolated Supabase hub-email-test
(pwaubtyinxuncelqzwlx), entered scoped SMTP credentials privately, and created one
controlled synthetic Auth account. SMTP sender is no-reply@mail.schrex.com,
display name Schreiber Hub Test, host smtp.postmarkapp.com, port 587.

First recovery attempt was rejected by Postmark's pre-approval same-domain rule.
After approval, one retry succeeded: Postmark Activity shows Delivered for Reset
your password, message a7f6de08-8c9b-4c5c-a028-ab1fd46cfc54. This proves SMTP
submission and recipient-server acceptance, not inbox placement or completion of
the reset-link/password-change/login flow. Those remain unverified. No app queue
activation or production/rehearsal SMTP change occurred. The Postmark server named
hub-rehearsal is separate from the Supabase project of the same name; this test used
only Supabase hub-email-test. No credentials or recovery links recorded here.

## Hosted trigger authority checked and candidates split — 2026-10-19

Read-only hosted catalog check confirms postgres owns all 60 business tables.
auth.users belongs to supabase_auth_admin; postgres has TRIGGER on that table and
EXECUTE on handle_new_user, but lacks owner privileges and SET ROLE to its owner.
Therefore CREATE permission does not imply permission to DISABLE an Auth trigger.
No business/Auth triggers or pg_cron/pg_net/pgmq extensions are installed yet.

Split private preparation into 70 public triggers, each disabled, and one commented-only
Auth trigger for later activation review. The original combined disabled-triggers.sql
is historical preparation and must not be used on hosted rehearsal. Generator now
also emits the split files. All 70 public definitions passed a local transaction test
as postgres with every trigger disabled, followed by rollback. Hosted authority
evidence saved privately. No hosted writes, grants, ownership changes or activation.

Next ordered step: validate hosted public function dependencies, then prepare a
transactional runner for the 70 disabled public triggers. Account-trigger activation,
client grants, Storage policies and outbound processing remain separate later steps.

## Private grants and disabled-trigger preparation — 2026-10-19

Recovered ACL-preserving schema from the original private archive; earlier schema.sql
had omitted ACLs. Extract contains 931 ACL statements, 422 related to public schema.
Public-related statement targets: postgres 8, anon 81, authenticated 140, service_role
104, sandbox_exec 64, PUBLIC 25. Eight statements concern email dispatch/wake RPCs.
These counts include revokes/default privileges, not only grants. No blanket replay:
source-specific sandbox role and outbound function access need explicit review.

Prepared private behavior-review bundle with 71 exact business/account trigger
definitions, each immediately disabled, and commented-only grant review material.
Ten managed/queue triggers excluded. Source and candidate fingerprints recorded;
no hosted runner exists and no definitions or permissions have been applied remotely.
Generator refuses overwriting an existing bundle. Private SQL remains outside Git.

Validation: transaction-only local replay of all 71 triggers passed with all disabled,
then rolled back. Initial postgres attempt failed on ownership of auth.users and rolled
back; local supabase_admin succeeded. This highlights a hosted ownership requirement,
not authorization to change managed ownership or proof the hosted postgres role can
apply this bundle. No application rows were inserted or changed during validation.
Next: split the Auth trigger from public triggers, resolve hosted role ownership using
read-only catalog evidence, and review grants by operation before activation. Outgoing
workers, schedules, access and production remain unchanged.

## Synthetic permissions and behavior checkpoint — 2026-10-19

All four existing verify:backend checks pass: 60-table client inventory, Auth/time-off
workflow, time-off permission regression and HR/compensation/audit checks. Local
time-off browser workflow also passes (employee request, privacy, admin approval,
persisted employee read-back). This local backend includes the unreleased time-off
permission candidate; these passes do not certify the imported source policy behavior.

Added `test:local:storage` to the backend verification group. Synthetic job-plans and
job-photos tests pass for employee read, anonymous denial, employee upload/update/delete
denial with independent service read-back, and admin upload/delete. Synthetic objects
are removed afterward. All 57 exported Storage CREATE POLICY definitions exactly match
the local dump after whitespace normalization; no private policy dump enters Git.
This comparison does not establish matching grants, helper functions or hosted behavior.
Targeted script ESLint and whitespace checks pass. Bun 1.3.14 / Node 26.8.2 used.

No hosted permissions, triggers, access settings, workers or schedules changed. Next:
prepare/review the remaining source grants and mutation triggers, separate outbound
queue/scheduler behavior, then stage a restricted hosted smoke test. Foreman/office
roles, remaining buckets, Realtime and external integrations still need coverage.

## Hosted Storage ownership independently verified — 2026-10-19

Operator completed all 13 API ownership updates and byte checks. Private run report
confirms 13 verified requests, no request in flight and API updates complete. Fresh
read-only hosted metadata query independently matches all 23 source object paths,
both owner fields, sizes, MIME types, cache-control and empty custom metadata. Zero
mismatches. All 15 buckets remain private, bucket owners remain empty and no Storage
policies are installed. Post-correction evidence saved separately in the private archive;
earlier comparison evidence retained. No secrets read or source changes performed.

Database business/Auth content and file content/ownership now have independent
reconciliation evidence. This is not yet a usable application restore: reviewed
permissions/grants, triggers, queues, integrations and application behavior remain
pending. Keep access/email/workers disabled and destination scheduler history empty.
Next milestone: test reviewed access rules and behavior with synthetic local data
before preparing any hosted activation. No production cutover is authorized.

## Ownership correction tested locally; operator helper prepared — 2026-10-19

Synthetic loopback-only Storage API proof passes: updating identical bytes with a
short-lived signed JWT carrying the original owner as subject restores both owner
fields, preserves the object ID, bytes, MIME/cache settings and bucket privacy.
Synthetic file/bucket cleaned up. No hosted mutation or credential retrieval occurred.

Prepared `scripts/rehearsal-storage-owners.py`: default is offline plan validation;
explicit `--apply` requires hidden rehearsal service-key/signing-secret prompts and
isolation attestation. The signing secret must cryptographically match the fixed-project
legacy service key. Tokens last five minutes, exist only in memory, and are used only
against the fixed rehearsal Storage endpoint. Exact private inventory and all existing
bytes are verified before updates; each changed object is downloaded again afterward.
Private progress records contain counts only; prior runs block retries pending review.
Independent read-only ownership reconciliation remains required after execution.

Validation: actual private offline plan passes 13 owners/23 files; eight Storage unit
tests pass, including wrong signing secret, public buckets, changed bytes and ambiguous
write/no retry. Synthetic API proof passes; git whitespace checks pass. Hosted correction
is NOT executed. Access remains disabled; permissions/application behavior still pending.

## Storage byte copy confirmed and metadata compared — 2026-10-19

Private restore report confirms completion: all 23 files verified and 15 private
buckets inventoried. Read-only hosted metadata query compared hashed object paths
and owner IDs against the original private storage snapshot. All 23 paths, sizes,
content types, cache-control values and empty custom-metadata states match. All
15 buckets remain private with empty owners; target storage policies remain absent.
Source bucket owners were also empty. Private comparison evidence saved outside git.

Thirteen source objects have owner and owner_id values absent at destination after
service-key upload; ten originally ownerless objects match. No ownership correction
applied. All 57 source storage policies were inspected for owner references; none
reference owner fields. This does not certify policy access or justify discarding
ownership provenance. Original exact mappings remain in the private snapshot.

Source-public talk-media remains private by design and rehearsal size limits remain
capped. Storage-generated IDs, versions/timestamps are not claimed identical. Supabase
recommends treating Storage metadata as read-only and using its API for mutations;
do not blindly UPDATE owner columns or replay the storage dump. Next: validate an
ownership-preserving migration method and review/test the original storage policies
before any access activation. No production or destination data/configuration changed
in this inspection step; no credentials read. Read-only SQL query succeeded and git
whitespace checks pass; no app tests needed for inspection-only SQL/documentation.

## Database content verified; Storage helper prepared — 2026-10-19

Read the private comparison report: all 62 business/account COPY sections pass,
including all password-hash fields. The data-only circular-FK warnings do not affect
this offline comparison; that capture is not being restored. No constraints changed.

Prepared fixed-target Storage API helper: validates the private comparison capture,
23 local file hashes/sizes and original storage inventory, prompts privately for the
existing rehearsal service_role key, rejects wrong-project/anon keys, and keeps keys
out of arguments/files/logs. Creates 15 private buckets, uploads without upsert,
downloads each file for byte/hash verification, and checks final bucket/path inventory.
Refuses public/unexpected buckets, extra objects or changed existing content; partial
runs can resume only after existing-byte verification. No delete or automatic retry.

Five mocked tests pass (upload/resume, public-bucket refusal, changed-file refusal,
no retry, bad path/key). Actual source preflight passes 15 buckets/23 files; largest
file is below 50 MiB. No hosted upload performed. Bucket size limits are capped at
50 MiB for rehearsal; original settings remain archived. Object IDs/ownership,
user metadata and timestamps still require separate reconciliation before access.
Browser auto-review blocked opening API keys because it could reveal the secret;
operator will navigate/copy privately. No key read or generated by the assistant.

## Operator baseline commit and reconciliation preparation — 2026-10-19

Operator reports successful baseline commit from the corrected direct-psql helper,
with private evidence in runner-1792441149159. The runner's transaction/count/RLS
checks passed according to its success result; independent content reconciliation
is not complete yet. Do not rerun the importer or enable client access.

Prepared `scripts/rehearsal-data-check.sh`: fixed-target, verified TLS, hidden-password
read-only pg_dump of public tables and Auth users/identities into the private archive.
The offline comparator verifies pinned source fingerprints and compares complete
COPY column lists and order-independent row-hash multisets, preserving duplicate
counts. All fields, including password hashes, participate; values are never printed.
Partial captures fail closed. Reports remain private. Sequences, permissions, files
and application behavior are explicitly outside this comparison's scope.

Validation: 27 tooling tests pass, including changed hash/content, reordered rows,
duplicate multiplicity, table/column mismatches and truncated input; shell syntax and
whitespace pass. Waiting for operator capture with private password. File restoration
follows only after this comparison passes; production remains untouched.

## Password-path isolation — 2026-10-19

Operator reset the rehearsal database password and supplied a successful read-only
login screenshot (postgres 17.11, read_only on, rollback). The two intervening import
attempts failed authentication before any SQL ran. This proves the current password
and pooler connection work; the exact cause of the failed prompts is not established.
Changed the import helper to use direct psql entrypoint, matching the working login
helper, instead of a shell-wrapped process with redirected streams. SQL output stays
in a precreated 0600 private file; quiet SQLSTATE-only errors omit data values/context.
A synthetic local conversion-error check verified its marker is absent from output.
Shell syntax and whitespace pass. No hosted import performed by the assistant.

## Import retry correction — 2026-10-19

First operator import attempt failed at the managed identities-to-users foreign key:
the archive's account COPY order was identities then users. Corrected the runner to
move the two complete COPY blocks into users-first order without changing payloads.
Verified both real candidate block hashes are unchanged; no credentials or rows
printed. A fresh hosted aggregate query confirms zero users, identities and public
tables after failure, consistent with full transaction rollback. No cleanup needed.

Added regression coverage that reproduces the FK error with synthetic COPY data and
proves the actual ordering transform succeeds. All 23 tooling tests and the synthetic
commit/rollback/nonempty/permission checks pass; temporary database removed. The
previous test inserted only a user and missed this dependency; it now covers identities.
Retry still requires the operator's private password. No successful hosted import yet.

## Rehearsal isolation and baseline import runner — 2026-10-19

Applied destination-only controls to hub-rehearsal: public signup off, Email provider
off, Data API disabled, and enabled a Postgres Send Email hook that always returns
403 without sending or recording its input. No production setting changed. Added
fixed-target, TLS-verified, hidden-password database baseline runner with private
artifacts/logs, pinned input hashes, empty-target checks, one transaction, count/RLS
checks and no automatic retry. All app triggers/client grants/queues/schedules and
file restore remain separate. Fresh-sign-in treatment is explicit in its operator
confirmation. No real-data import executed; original archive unchanged.

Validation: 21 tooling tests, shell syntax and whitespace pass. Synthetic-only
transaction test passes commit, late-error rollback, nonempty-rerun refusal, client
read denial and Auth mail-block role checks. Temporary test database removed; no
employee rows loaded locally. Private import bundle prepared. See
[runner scope and operator instructions](docs/migration-import-runner.md). Complete
restore, hosted execution, content reconciliation, storage upload and application
behavior/grant restoration are still unproven. Do not enable client access yet.

## Managed schema comparison and synthetic replay — 2026-10-19

User completed hidden-password schema capture. The owner-only destination file has
a pg_dump completion marker. Compared normalized pg_dump objects: all 292 managed
Auth/storage objects match source definitions, including tables/defaults, enum types,
constraints, indexes and managed functions/triggers. Owners and ACLs were omitted
from both dumps and are not certified by this comparison. The 58 source-only objects
are expected app customizations: 57 storage policies and one Auth new-user trigger.
Extracted those privately into a separate review file, not applied.

Tested destination-managed schema plus selected public pre/post schema in a separate
disposable local database. Both stages loaded successfully; synthetic user/job inserts
succeeded and transaction rollback left no rows. No actual backup row was loaded.
Test database removed; normal staging unchanged. This tests schema ordering and basic
transaction handling as local superuser, not hosted privileges or real-data restore.
Private comparison/synthetic result evidence saved alongside archive. Import remains
blocked on effective destination client/Auth/mail isolation and final transaction
runner/privilege review. No further password/schema capture is needed for this result.

## Staged migration candidates — 2026-10-19

Prepared private pg_restore-selected SQL candidates (no SQL execution) under the
approved archive's `candidate-import/`: public pre-data/post-data, all 60 business
tables, and Auth users/identities. Counts and COPY payload hashes exactly match the
inspected backup for all 62 data sections. Originals are unchanged. Candidate schema
scan found no source-project URL, network/cron call, Vault reference or URL literal;
pgmq remains a dependency. This scan is not full executable safety proof.

Added structural TOC selector with six synthetic tests (16 inspection/selection tests
total pass). It defers triggers, grants, source dispatch/wake functions and all managed
platform objects, never strips COPY rows. Public post-data retains RLS/constraints.
Account candidate includes users/identities only: session/refresh/MFA-AMR/token state
remains archived and its fresh-sign-in treatment must be finalized explicitly. Empty
other durable Auth tables and nonempty migration history are not blindly loaded.

Prepared `scripts/rehearsal-schema-check.sh`: fixed destination, verified TLS,
read-only pg_dump, hidden password prompt, private output; shell syntax passes.
User asked to run it to complete constraints/defaults/enums comparison. No password
requested in chat, no destination settings changed, no import runner approved or
executed. Candidate SQL must not be run standalone: grants, triggers, pgmq setup,
managed compatibility and destination client/mail isolation remain required.

## Read-only destination compatibility preflight — 2026-10-19

Rechecked hub-rehearsal via authenticated dashboard and metadata/aggregate SELECTs.
Confirmed empty users/public tables/buckets/objects. Compared all 344 Auth/storage
column types and generated-column classifications: match; all source COPY columns
present. Six generated columns correctly omitted from COPY. Exact constraints,
enums, defaults and executable compatibility still need review; no restore proof.

No deployed Edge Functions/Auth hooks; SMTP off, signup on, SSL enforcement off,
network unrestricted. Controls unchanged. Destination remains not isolated for real
import. [Current evidence](docs/migration-destination-audit.md) records gaps and the
next destination-only isolation step. Private catalog/comparison saved outside git.
No employee rows or secrets accessed; no import, deployment or paid changes.

## Backup inspection and restore selection plan — 2026-10-19

Offline decoding and private reconciliation completed without executing SQL.
Verified 60 public table-data sections, 25 Auth users/identities with nonempty
password hashes, valid identity/profile links, and all 23 file paths/sizes/checksums
against private capture. Eight queue tables are empty. One source cron job is
active; one Vault row and source-targeted email wake/dispatch functions require
quarantine/inert adaptation. Original archive preserved; no destination import.

[Restore plan](docs/migration-restore-plan.md) defines object selection, ordering,
validation and remaining gates. Private review matrix covers all 1,666 TOC entries
but is not executable/approved. Next: current destination catalog comparison and
isolation verification, then final managed-schema/adaptation review. Do not treat
SQL byte size as capacity proof. DNS remains pending; no real data entered synthetic
staging. Inspection-only documentation changes: whitespace checked; app tests are
not evidence of restore compatibility and were not rerun.

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

## Review packaging and current scope — 2026-10-19

DNS verification and the full database export remain blocked on access. The accepted
email plan is Supabase Auth SMTP through Postmark and the existing notification
queue. New delivery-tracking infrastructure is paused; the standalone adapter and
additional safeguards below are optional review work, not prerequisites for DNS
verification or a rehearsal password-reset test. No provider switch is enabled.

Migration documentation/private-inspection tooling is being packaged in draft PR
#10; runtime integration changes are isolated in a separate draft targeting develop.
Historical entries below describe that companion work, not code included in the
audit PR. A separate job Files feature starts from develop and uses synthetic data.
Neither review authorizes merging to main or deploying. Full independent restore
remains unproven; preserve business records/Auth/files and exclude destination
scheduler execution history while leaving the source untouched.

## Suppression and retry safeguards — 2026-10-19

Added delivery-time suppression checks to the worker: transactional mail checks
current suppression and used unsubscribe tokens; Auth ignores marketing unsubscribe
but honors bounce/complaint/unknown suppression. Lookup failures defer without
provider attempts or retry-budget increments. Initial cooldown state, prior-sent
and failed-counter lookup failures stop processing. HTTP429 now uses schema-supported
`pending` plus metadata instead of unsupported `rate_limited`; log/cooldown write
failures stop the batch. No deployment or provider switch.

Postmark standalone adapter now exposes explicit `deliver()` outcomes, intentionally
incompatible with the worker's void-send interface. Ambiguous timeout, malformed
success and server responses require reconciliation, never ordinary retry. Known
suppression/configuration/permanent rejection and rate limits remain distinct.
No durable hold is claimed: actual claim/receipt persistence and concurrency control
still require implementation before activation. Current queue RPC timestamp and
enqueue idempotency gaps are recorded in [safeguards](docs/migration-email-safeguards.md).

Validation: 174 normal-suite tests, app typecheck/build, lint (30 existing warnings),
all 18 Edge entry points and explicit Postmark module Deno check pass. New guarded
local DB test passes 24 suppression/token/queue combinations, actual REST error
deferral and schema-valid rate-limit logs without consuming retries. Fixtures cleaned,
no reset or queue/provider calls. Added this test to backend verification and verified
the package command. [Local validation](docs/migration-email-local-validation.md)
distinguishes helper/DB checks from served-worker or concurrency proof. Existing
browser/full backend suites not rerun; no UI/schema change. DNS remains pending;
Postmark stays disconnected, production unchanged, real-data import paused.

## Postmark account inspection and adapter — 2026-10-19

User provided a signed-in Postmark tab. Read-only inspection confirms Owner access,
existing `hub-rehearsal` server 21137606, default outbound/broadcast/inbound streams,
SMTP enabled and open/link tracking disabled. Account test mode is not a proven
non-delivering Sandbox server; inspected UI did not establish server delivery type.
User subsequently completed account-email confirmation; refreshed dashboard no
longer shows that banner, but account test mode remains. Both `mail.schrex.com` and
`schrex.com` show unverified DKIM/Return-Path. Recorded exact public DNS values for
the subdomain and planned Auth SMTP fields in [Postmark setup](docs/migration-postmark-setup.md).
DNS access remains pending; no records, settings, tokens or account approval changed.

Prepared standalone Postmark API adapter and 11 fake-request tests. Explicit stream,
content, unsubscribe headers and provider receipt mapping; raw errors sanitized,
HTTP/API codes separated, no automatic retries or assumed idempotency. Worker remains
on Lovable. Activation requires suppression/permanent-error handling, provider receipt
persistence and duplicate-send reconciliation, plus distinct Postmark webhook auth.
See [adapter report](docs/migration-postmark-adapter.md).

Combined app checks pass: TypeScript, 132 tests and build; lint 0 errors/30 existing
warnings. Standalone adapter Deno check passes. No network email tests, credentials
read/generated, live sends, DNS edits, paid upgrades, deployment or production changes.
No browser/backend rerun needed for the unconnected adapter. Export/import remains paused.

## Track 2 email, SMS and speech preparation — 2026-10-19

Continued with three agents on existing feature branch. Added 11 unsubscribe token
compatibility tests, 12 SMS fake-fetch tests, and 21 speech tests. SMS transport now
rejects success without a message ID and stores sanitized failure codes. Speech
retains Deepgram/ElevenLabs paths and fallback, with sanitized errors and transcript
type checking. Removed raw unsubscribe token logging. Existing providers remain
unchanged; no live delivery or deployment. Combined 121 tests/build pass; a speech
TypeScript narrowing issue was fixed and final typecheck passes. Lint passes with
30 existing warnings. All 18 Edge entry points pass; suppression/unsubscribe now
included. Browser/backend suites not rerun for these transport-only changes.

Rechecked authenticated Lovable domain UI on user request: sending domain
`notify.www.schrex.com` Verified. Public DNS confirms Lovable NS delegation and
Mailgun SPF/MX; `schrex.com` uses domaincontrol nameservers, while
`schreiberexcavating.com` uses Wix nameservers. User reports Outlook company email
and GoDaddy OTPs. Account ownership/access and independent provider selection
remain pending. [Provider setup](docs/migration-provider-setup.md) records details.
No OTP used, DNS changed, credentials read, production modified or paid service
provisioned. Real-data export/import stays paused.

Remaining mail gates include delivery-time suppression recheck, non-atomic
unsubscribe writes, provider-specific webhook verification and independent Auth
mail configuration. [SMS](docs/migration-sms-preparation.md) and
[speech](docs/migration-speech-preparation.md) reports distinguish stub tests from
real delivery/hosted authorization proof.

## Login helper and integration implementation — 2026-10-19

Continued user-authorized steps 1–3 without importing real data or changing hosted
settings. Existing feature branch and prior dirty changes preserved.

- Private login: `scripts/rehearsal-login-check.sh` fixes the rehearsal target,
  uses verified TLS and the existing PostgreSQL 17.11 container client, prompts
  privately and runs one read-only identity/version query. Syntax, noninteractive
  refusal, client and CA mount checked. User-supplied terminal screenshot confirms
  successful operator login/query: database/role `postgres`, version 17.11,
  `read_only=on`, completed ROLLBACK without visible errors. No password disclosed.
  See [connection readiness](docs/migration-connection-readiness.md).
- Email: extracted existing expiry/retry/error policy into a helper used by the
  worker; 20 new regression cases pass, preserving current behavior. Lovable remains
  the default. Full queue effects and independent delivery remain untested.
- Google: opt-in Supabase OAuth path with local-mode guard, default Lovable path,
  failure handling and 12 mocked helper/UI cases. No hosted provider enabled.
  [Google preparation](docs/migration-google-preparation.md) records setup gates.
- AI: provider-neutral JSON chat helper used by `suggest-safety-topic`; existing
  endpoint/model retained. Seventeen fake-fetch cases cover request/error/malformed
  responses. Invalid payloads are now rejected and provider error bodies are not
  logged. [AI preparation](docs/migration-ai-preparation.md) records limits.

Combined app typecheck/build passed, and final normal Vitest suite passes 77 tests.
Edge static checks pass all 16 entry points; existing synthetic browser test passes
1/1. Lint passes with 30 existing warnings. Browser/Edge tooling needed network
escalation after sandbox registry access failed; approved retries passed.
Company-owned provider account inventory is awaiting user input. SMS and speech
remain in scope but have not been replaced. No real provider calls, deployments,
paid provisioning, production edits, merge/push or export/import occurred.

## Four parallel follow-up workstreams — 2026-10-19

User authorized email preparation, synthetic testing, connection preparation and
launch-feature planning in parallel. Three agents handled implementation/tests/scope;
primary agent inspected connection details and integrated the results on the existing
feature branch. All existing dirty work was preserved; changes remain uncommitted.

- [Email preparation](docs/migration-email-preparation.md): provider-neutral delivery
  interface and test-only `.test` sink; queue worker still uses Lovable by default.
  Nine new synthetic cases pass. Queue client typing corrected for static checking.
  No replacement provider or actual delivery has been tested.
- [Synthetic validation](docs/migration-synthetic-validation.md): signup, linked
  profile/contact, forged-role rejection, login UUID continuity and private-file
  access/denials pass on existing disposable Docker. Added the new test to the
  backend verification group. No reset; unique fixtures cleaned up.
- [Connection readiness](docs/migration-connection-readiness.md): dashboard confirms
  free session-pooler route. Downloaded public CA; OpenSSL verifies TLS 1.3 chain and
  hostname. Direct DNS resolution failed; Python strict CA validation rejects a
  missing key-usage extension. No verification bypass. User has password privately;
  no authenticated SQL connection attempted. Host psql not found in checked locations.
- [Launch scope](docs/migration-launch-scope.md): retain existing capabilities in
  preparation scope; no deferral approved. Independent provider/account access and
  actual feature readiness remain pending; no paid service selected.

Validation: app typecheck/build and 28 unit tests passed; original backend group
4/4 and browser 1/1 passed; new Auth/storage script passed, including via its newly
wired package command. Lint passes with 30 existing warnings. Edge group and explicit
queue-worker static check passed; worker now included in the routine Edge list.
No hosted writes, import, secrets in git, production changes, merge/push, or Lovable
cancellation. Database download/import remains paused. Real-data recovery remains
unproved; synthetic testing is not hosted parity.

## Parallel migration preparation — 2026-10-19

Three user-requested agents prepared offline archive inspection, integration mapping,
and restore acceptance checks while the primary agent inspected the destination.
Database export download/import remains paused at the user's request because the
download link is unavailable. Work remains on `codex/migration-audit-live-findings`.

- [Destination audit](docs/migration-destination-audit.md): verified PG 17.11,
  one organization Owner, no Auth hooks, custom SMTP off, localhost site URL,
  no redirect URLs, and pg_cron/pgmq/pg_net disabled. Default Auth mail is not
  proven disabled. No settings changed; signup remains enabled for synthetic use.
- [Inspection tooling](docs/migration-restore-tooling.md): offline SHA-256 and
  format-candidate inspection with private-file/repository guards. Ten synthetic
  tests pass. This is not a restore executor or completeness validator.
- [Integration map](docs/migration-integration-map.md): provider dependencies,
  replacement work, required owners/access and planned synthetic checks. No
  provider calls or replacement integrations were implemented.
- [Acceptance checks](docs/migration-acceptance-checks.md): preservation and
  comparison plan plus two manual read-only SQL aids. Static guards pass; SQL
  syntax/database execution remain unverified. Destination scheduler history must
  start empty while source history, business audit and queue state are preserved.

Agent validation: focused Vitest 10/10; lint 0 errors with existing 30 warnings;
documentation links and whitespace checked. No production changes, import, paid
provisioning, merge, push or Lovable cancellation. Independent restore proof remains
blocked on the complete database/Auth export, secure destination connection,
compatibility review and effective side-effect isolation before real-data loading.

## Rehearsal destination inspected — 2026-10-19

User supplied project `acgqjjbrnkmeazswdnzp`; authenticated dashboard access verified.
Project name `hub-rehearsal`, organization Schreiber Excavating, Free plan, healthy
Nano compute in us-east-2 (Ohio). UI shows no public tables/views, no storage
buckets, no deployed Edge Functions, no migrations and no backups. Auth user list
shows no users, but its estimated footer was inconsistent; exact counts remain
unverified. Public signup is enabled; anonymous sign-in is disabled, email
confirmation enabled, Email provider enabled and Google disabled. No settings
were changed and no data imported. Destination isolation, scheduler/extensions,
mail/hooks and secure restore connection still need verification/configuration.
Supabase's default branch label main/PRODUCTION is internal to this rehearsal
project; it is not the Git production branch and no repository is connected.

## Storage archive captured — 2026-10-19

Downloaded all 23 application storage objects from seven populated buckets via
Lovable's Storage UI; checked the other eight buckets and confirmed they are empty.
Ten original ZIPs, reconstructed bucket/object paths, and a SHA-256 manifest are
stored privately under `/Users/sumanththota/Schrex/archive/storage-2026-10-19`.
All ZIP integrity checks pass. Downloaded bytes total 66,632,006, matching the earlier
aggregate inventory. Files and detailed object paths are outside git. No source
objects or bucket settings were changed. Current UI displays 5 GB global upload
limit (earlier audit recorded 2 GB); no limit change was performed by this agent.

ZIP downloads flatten parent paths, so the private manifest records observed source
prefixes and `objects/` reconstructs them. Hashes cover downloaded bytes; independent
server hashes, complete owner/content-type/cache-control metadata, and restore proof
remain pending. Capture occurred with live writers, not an atomic freeze. The private
`database_export_19_10_26` bucket was still empty when checked after file archiving;
database export completion/download remain pending. Synthetic staging is unchanged.
Documentation-only repository changes; `git diff --check` passes. Application test
suites were not rerun for this archive operation.

## Database export requested — 2026-10-19 14:33 UTC

User selected `/Users/sumanththota/Schrex/archive` as the temporary local archive.
Created the directory with mode 0700, owned by the local user, outside this repo.
User explicitly approved the intermediate Lovable Cloud storage and emailed
temporary download-link workflow. Clicked Start export; Lovable confirmed
“Database export started” and that it will email a download link when ready.
No archive downloaded yet; export completion, completeness, checksums and restore
remain unverified. Storage files still require separate downloads. Source records,
scheduler history, settings and running services were not changed by us; the
requested export creates a backup artifact. No paid provisioning or deployment.
The restricted independent restore destination is still unresolved.

## Migration preparation — current status (2026-10-19)

This entry supersedes older branch/merge status below; those entries are retained
as historical verification records. PR #7 and PR #8 are merged into develop
(`936bef8`). Remote main remains `5a81add`; local main remains `37284f0`.
Draft PR #10 targets develop, with head `528b424` on
`cursor/migration-audit-4b4b`. The clean local continuation branch
`codex/migration-audit-live-findings` matched that head before this documentation edit.
All five hosted checks pass at that head (run 39265809535); they do not prove recovery.

Read AGENTS.md, this record, local/README.md and the updated PR audit. Rechecked
Lovable access in the in-app browser: Cloud overview, Advanced settings and export
confirmation load. Canceled before Start export. No production settings/data were
changed, no export downloaded and no restore performed. No paid infrastructure,
merge, deployment or Lovable cancellation occurred.

The next milestone is private complete exports and an independent restore proof.
[Export/rehearsal preparation](docs/migration-export-rehearsal.md) records exact UI
steps, preservation/exclusion policy, verification criteria and access gates.
Private archive location/owner, protected transfer path, restricted execution host
and existing rehearsal target remain unidentified. Actual archive completeness,
Auth/hash compatibility and all file checksums remain unverified. Destination
scheduler history must start empty; source history and business/audit/delivery
state must be preserved. Synthetic staging stays separate from real-data rehearsal.

No application code or migrations changed in this preparation. Hosted checks were
inspected; local app/backend/lint/edge/browser suites were not rerun for docs only.

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
are not release approval: that checkpoint had 53 lint errors / 30 warnings; the follow-up cleanup now has
zero errors / 30 warnings.
Those checkpoint commits did not change main. Subsequently, develop and all four
feature branches were published (see dependency publication entry below). GitHub
branch protection remains unconfigured. No merge or deployment has occurred.

Complete the local backend foundation and reconcile it with an authoritative Cloud
schema. Current status: **partial local proof; not ready for staging or release**.

| Work item | Status | Evidence / next action |
| --- | --- | --- |
| Repository/build baseline | Verified locally | Build + TypeScript pass; cleanup branch lint has 0 errors / 30 warnings |
| Isolated local Auth/database | Verified for limited scope | Synthetic accounts; API on 55321; `dev:local` |
| Time-off happy path and cross-user isolation | Verified locally | `bun run test:local`; prior manual browser submission |
| Targeted HR schema reconstruction | Verified locally; full parity pending | Supplied export incorporated; `local:audit-schema`: 60/60 tables and column names |
| Permission state transitions | Fixed and verified locally; NOT deployed | Forward migration `20261016210000`; permission + happy-path tests pass |
| External functions/Realtime | Not implemented locally | Explicitly disabled, not silently considered tested |
| Verification command and CI definition | Implemented and checked locally | First hosted app/backend checks pass; all three hosted groups pass at dbc66c1 |
| Branch protection | Not configured | Required remote checks await first GitHub run and lint cleanup |
| Staging | Not established | Separate backend and integration credentials needed |
| Production release | Not started | All seven release steps below remain pending |

## Foundation review — 2026-10-18

Reviewed local preparation/startup, verification workflow, permission migration,
API assertions, and release packaging. The fixed-loopback backend guard, synthetic
fixtures, unchanged historical migrations, exact authorization/constraint assertions,
and read-only CI permissions support continued isolated development. A fresh GitHub
runner successfully rebuilt the local database and passed the four backend checks.

Remaining review findings before integration/release:

- Resolved on the consolidation branch: the new time-off candidate now lives in
  local/candidate-migrations, outside normal production migration discovery.
  local:prepare copies this exact file only for disposable tests. Its eventual
  production promotion remains a separate explicitly authorized release.
- Local replay deliberately differs from production in four documented ways.
  The 60-table/column inventory does not validate full ACL/function/trigger parity.
- External functions and Realtime are disabled in the disposable backend. Static
  checks of edited functions do not establish live behavior or delivery success.
- CI is now running, but branch protection and staging/recovery are still absent.
  Draft dependency PRs include foundation changes and must not be treated as small,
  standalone production updates. Main was not changed in this review.

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
2. Review draft cleanup PR #7 alongside dependency PRs #4–#6. All three hosted
   verification groups pass at dbc66c1; 30 lint warnings and branch protection remain.
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

- 2026-10-18 browser automation: new codex/time-off-browser-test branch from develop
  merge 48ac1c9 (PR #7). Added pinned Playwright, isolated Chromium sessions and a
  time-off workflow test. Dedicated guarded frontend uses 8082; normal 8080 remains
  available. Each test cleans up only its unique synthetic request. CI adds a fifth
  browser job with a fresh disposable backend. Local workflow passed. Disabling the Approve action made the test fail at
  the pending-request assertion; restoring the app passed again. App/type/unit/build
  and lint checks pass (19 unit tests, zero lint errors, 30 warnings). All five hosted groups passed for 3c9866d in run 39165379937, including the
  browser workflow on a fresh Linux backend. PR #8 targets develop; not merged. Branch protection is unavailable
  on the private repository's current plan; the user selected manual PR/check review.
  No production changes or new integration merge occurred.

- 2026-10-18 combined local smoke test at aa6b03a: installed the exact frozen
  Bun lockfile in the actual checkout (Vite 6.4.4 / Vitest 5.0.5), started the
  disposable backend without reset, and launched guarded dev:local on 8080.
  Browser: employee login, Nov 9 synthetic vacation request submission (Pending),
  admin login and approval, other employee login with no visible requests, and
  original employee re-login showing Approved all passed. The single synthetic
  browser request was retained for inspection, labelled
  "Synthetic combined PR7 browser smoke 2026-10-18". Screenshot is temporary at
  /tmp/schreiber-combined-smoke-approved.png; the local tab remains open.
  Separate test:local and test:local:permissions passed, confirming cross-user
  reads/forged ownership are blocked, reversed dates rejected, self-approval and
  cancellation tampering rejected, and legitimate cancellation allowed. API test
  records were cleaned up by the scripts. No real employee data was used.
  Email delivery and Realtime remain untested. No branch protection changes,
  merge into develop/main, or production deployment occurred.

- 2026-10-18 consolidation: moved the unapplied time-off candidate out of
  supabase/migrations into local/candidate-migrations without changing its SQL.
  Local preparation still copies it explicitly into the disposable replay.
  Added verify:edge/typecheck:edge and a fourth CI group using Deno 2.5.6, checking
  the 15 edited entry points and imported modules without executing handlers.
  PR #7 is the combined development foundation; fully contained predecessors
  #4–#6 were closed with supersession links after verification. GitHub run
  39163074345 at 0e07a7e passed all four groups: app, fresh backend replay, lint,
  and Edge Function types. Local checks also passed and candidate SQL is unchanged.
  No merge or production deployment occurred. Predecessor branches remain retained.

- 2026-10-18 verification cleanup: isolated follow-up branch codex/verification-cleanup
  based on the Vitest replacement. Added codex/** push triggering; GitHub run
  39161662623 passed app and fresh-backend checks, while lint failed on its original
  53-error baseline. Earlier PR-trigger absence remains unexplained; Actions is enabled.
  Cleanup now passes local lint (0 errors / 30 warnings), frozen Bun install,
  TypeScript, 19 Vitest tests, build and four backend checks. Deno 2.5.6 static checks
  pass for all 15 edited Edge Function entry points. Scoped query/response contracts
  replace explicit any; these are not blanket runtime validation. Notification
  recipient extraction handles object and array profile embeds and has regression
  coverage. No services were invoked or deployed. Hosted cleanup validation passed at dbc66c1: run 39162075252 reports app, backend
  and lint success. This includes a fresh database replay on GitHub. Follow-up
  documentation commits do not change the tested code. PR #7 tracks this cleanup.


- 2026-10-18 dependency replacement publication: published develop at 5a81add and
  the foundation/source-map/brace/Vitest feature branches. Opened draft PRs
  [#4](https://github.com/Schrex/schreiber-hub-central/pull/4),
  [#5](https://github.com/Schrex/schreiber-hub-central/pull/5), and
  [#6](https://github.com/Schrex/schreiber-hub-central/pull/6), all targeting develop.
  These branches are cumulative: review foundation first, then source-map, brace,
  and Vitest. Their current full diffs include the unintegrated foundation and its
  forward permission migration; do not treat them as dependency-only release diffs.
  Linked and closed original npm PRs #1/#2/#3 as superseded. No production alert
  is considered resolved by closing those proposals. Remote main remains 5a81add;
  local main remains 37284f0. No merge or deployment occurred.
  Initial GitHub checks are absent, despite Actions being enabled; the reason has
  not been established. Hosted verification and lint cleanup remain required.

- 2026-10-18 remaining dependency validation: brace commit 2e7d88c updates the two
  locked lines to 1.1.21 and 2.1.7 without changing parent major requirements.
  Fresh frozen install, type checks, nine unit tests and build passed; parent
  resolution and ordinary expansion behavior passed for both versions.
  Vitest commit 557a7b3 upgrades Vitest to 5.0.5 and Vite to compatible 6.4.4;
  tinypool is absent from the resulting lock. Fresh frozen install, app checks
  and all four local backend checks passed. Synthetic employee browser login
  passed on an isolated Vite 6 server. Both branches retain 53 lint errors and
  30 warnings. Tests used temporary dependency installs; the existing port-8080
  server was not upgraded by these checks. External integrations remain untested.

- 2026-10-18 PR #1 Bun equivalent: created codex/bun-source-map-js-update from
  foundation commit bc8f85e. Added a targeted source-map-js 1.2.2 override and
  regenerated bun.lock with Bun 1.3.14. No other resolved package changed.
  A plain bun update initially added a direct dependency while retaining the old
  PostCSS copy; those intermediate changes were discarded before the override.
  Fresh isolated frozen install, type checks, nine unit tests, and build pass.
  Verified PostCSS resolves 1.2.2 and generates a readable source map with the
  original CSS location. This is a compatibility check, not a vulnerability exploit
  test. Lint remains 53 errors / 30 warnings. Backend checks were not rerun for
  this build-dependency-only change. Existing running app dependencies were not
  replaced; verification used a separate temporary install.
  This branch depends on the unpublished Bun foundation; review its incremental
  diff against codex/local-development-foundation. PR #1 remains open; no new PR,
  push, merge, or production deployment was performed. Main remains 37284f0.

- 2026-10-18 local toolchain activation: installed verified Bun 1.3.14 at
  ~/.bun/bin/bun, added duplicate-safe PATH setup to .zprofile/.zshrc, and backed
  up pre-existing startup files with .before-schreiber-bun suffixes. A fresh
  interactive login shell resolves Bun correctly. Frozen install in the actual
  checkout succeeded without changing bun.lock. Confirmed local Docker startup
  without resetting data. Replaced two old repo Vite processes with one guarded
  dev:local server on 127.0.0.1:8080. All seven non-lint verification checks pass;
  existing 53 lint errors / 30 warnings remain. Browser login with the synthetic
  employee succeeded, and the Time Off screen loaded. Screenshot evidence saved
  to /tmp/schreiber-local-bun-verified.png (temporary). No production operations.

- 2026-10-18 Bun alignment: adopted the user-confirmed Bun 1.3.14 and existing
  text bun.lock. Added packageManager metadata; CI reads that version and runs
  frozen installs. Verification and local preparation scripts now use bun run;
  existing Node runtimes and pinned npx Supabase CLI remain explicit tooling
  dependencies. Updated setup/verification/agent docs. Fresh temporary install
  using only bun.lock passed app type/unit/build checks without changing the lock.
  All four backend checks also passed using the fresh Bun dependency installation
  against the existing disposable Docker instance (no reset).
  Removed package-lock.json and bun.lockb after that validation; their prior
  contents remain in Git history. Lint remains 53 errors / 30 warnings.
  Bun was not present on this Mac's PATH; validation used an isolated temporary
  1.3.14 installation, not a global installation. No dependency update was made
  to bun.lock, so the source-map-js update from PR #1 remains a separate task.

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
