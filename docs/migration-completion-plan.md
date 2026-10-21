# Migration completion plan

Prepared October 20, 2026. Planning only: no production deployment, main merge,
paid provisioning or cancellation is authorized by this document.

## Execution update — October 20, 2026

Permanent destination display name is now **schreiber-hub** (formerly hub-rehearsal),
renamed at the user's request. Its reference remains acgqjjbrnkmeazswdnzp; historical
rehearsal references below identify the same project.

Inherited pending work is preserved in b7df700. The subsequent local implementation
adds worker/unsubscribe reliability, controlled-recipient gates, deferred UI controls,
private safety media and an independent build/runbook. See DEVELOPMENT_PROGRESS.md
for verification and remaining gaps. Starting-point statements below are historical:
local fixes do not imply destination deployment, hosting, email activation or cutover.

Hosted follow-up: the eight allowlisted functions are now deployed with delivery
disabled. Token presence and non-secret settings are verified; worker missing/invalid/
anonymous denial and authorized disabled response pass after credential fix 5a5a720.
Queue grants, ordinary-user JWT/no-side-effects checks and controlled delivery remain
open; this is not completed backend or launch acceptance.

## Current acceptance update — October 21, 2026

- Backend service grants and controlled email proof are complete as recorded in
  DEVELOPMENT_PROGRESS.md. User confirmed the single fabricated message in the
  approved inbox. Delivery remains OFF and dispatcher uninstalled.
- Accident-photo replacement candidate is installed on schreiber-hub with exact
  catalog checks; local expanded Storage suite passes 590/590. Hosted role-based
  HTTP replacement acceptance remains pending.
- Private photo/document browser workflows and time-off refresh pass locally;
  resume/reconnect and signed-URL renewal fixes are in the feature checkout.
- All 15 hosted buckets remain private. Realtime publication has zero tables;
  live updates/denials are not accepted. Whiteboard now has a locally tested Refresh/return/reconnect fallback, and Safety
  uses permitted attendee columns. Hosted acceptance of the updated frontend and
  a launch decision on refresh-based versus live updates remain pending.
- Restricted independent preview, hosted workflow acceptance, recovery and explicit
  cutover approval remain next. Historical starting-point bullets below are not
  the current task status.

## Starting point

- Existing restored business data/Auth/files are the baseline: 62 COPY sections
  matched the archive before deliberate rehearsal changes; 23 files across 15
  private buckets were independently checked. Do not redo the migration by default.
- User reports source unused for three months. Resolve any newly discovered source
  changes before release; do not build a change-capture system.
- Rehearsal Auth uses Postmark SMTP and recovery codes. User confirmed recovery and
  login. Production-host recovery has not yet been tested.
- Reviewed database behavior/grants/policies exist. Two synthetic accident-photo
  Storage cases still fail; complete app acceptance has not passed.
- New transactional and dead-letter queues exist and are empty. No scheduler is
  installed. Four queue RPCs still deny service_role execution; no Edge Functions
  are deployed. CLI login is missing as of the last check.
- Current branch codex/export-capture has uncommitted recovery, email, deployment
  and documentation changes. Draft PR #10 targets develop. Passing local checks
  does not mean those changes are in the PR or running remotely.

## Scope and decisions

Day-one essentials: login/recovery, jobs, files, time off, truck requests and safety
reports, with the required application notifications. AI, SMS, speech, Google login
and celebrations email are deliberately deferred. Preserve their existing data.

New-account onboarding was explicitly paused. The current create-account code uses
an admin-chosen password, not an invitation workflow; hosted new-user setup is not
verified. Existing-user launch and a new engineer's onboarding are different goals.
Hide/disable account-creation and contact-conversion login actions in the launch
build while their backend setup is unavailable; existing contacts remain usable.
Do not promise the October 21 onboarding until that work is separately resumed and
passed. No new invitation feature is required merely to finish this scoped launch.

Decisions/access update — October 20, 2026:

1. User confirmed keeping acgqjjbrnkmeazswdnzp (hub-rehearsal) as the permanent
   backend for now. No additional copy is planned. This selects the destination;
   it does not authorize production cutover or notification activation.
2. User reports GoDaddy access and a newly created Cloudflare account. Account
   access/ownership and plan are not yet inspected. User confirmed the current
   Lovable app URL is https://app.schreiberexcavating.com/; the parent domain is
   schreiberexcavating.com. No DNS or hosting changes have occurred. Preserve email
   DNS/MX records; paid provisioning still requires separate authorization.
3. Private CLI login is now complete: the pinned CLI successfully returned an empty
   function list for the explicit destination on October 20. User is unsure
   whether the exposed Postmark server token was rotated; treat rotation as
   unverified. Inspect actual consumers before private replacement. SMTP stream
   credentials and server API token are distinct; retest Auth SMTP if affected.
   Private archive integrity was rechecked successfully during the implementation
   checkpoint. Final reconciliation remains a later release gate.

## Ordered execution

| Step | Work | Completion evidence |
| --- | --- | --- |
| 1. Save a reviewable checkpoint | Review current changes for correctness and secrets, separate application changes from historical restore tooling, commit on codex/* and update PR #10 or focused develop-targeted PRs. Preserve existing work; no main edits/merges. Reconcile stale status docs. | Clean, identified commit; reviewer can see the complete diff. Applicable app/lint/backend/Edge/browser groups pass, with remaining warnings/known failures explicit. Include the broader Storage HTTP suite for the two known failures. Pin the final release commit after later fixes. |
| 2. Finish destination backend access and deployment | Approve/apply service_role-only execution for enqueue_email, read_email_batch, delete_email and move_to_dlq. Verify email-table privileges/RLS and wrapper signatures. Deploy the eight-function allowlist below with exact project ref and EMAIL_DELIVERY_ENABLED=false. Review actual gateway auth/JWT compatibility, not just compilation. | Catalog check confirms service access and browser-role denial. Deployed names/versions match reviewed source; missing/invalid credentials rejected. A valid ordinary-user JWT must also be denied by process-email-queue with no queue claims/log writes, while an authorized service invocation succeeds. Queue operations work via the real destination API without delivering mail. |
| 3. Complete independent app email | Set fresh Postmark API secret privately, approved sender/stream and destination unsubscribe endpoint. Fix the non-atomic unsubscribe path (used_at currently precedes suppression insertion) with retry-safe/atomic behavior and failure tests. Complete Postmark-compatible authenticated bounce/complaint handling or explicitly documented equivalent suppression behavior; never reuse Lovable webhook verification. Verify every template's app links/recipient settings. | One fabricated notification to the owner's approved address travels enqueue → worker → Postmark → inbox. Verify log and queue deletion; suppression/unsubscribe and retry/DLQ failures tested synthetically. Test controls cannot drain arbitrary real recipients. Resolve effective recipient overrides and restored-role/settings fan-out before any send. No restored historical mail replay. |
| 4. Finish launch behavior | Disable deferred UI actions AND their backend entry points/deployments. Preserve manual job/safety workflows and existing media. Adapt stored media URLs to private destination Storage. Resolve the two accident-photo failures against the intended role policy rather than broadening access until tests pass. | Required files render/download/upload under intended roles; denied users remain denied. Required paths make no Lovable runtime calls. Relevant Realtime publications/subscriptions work or an explicit tested refresh behavior replaces them. |
| 5. Publish independent preview | Build from the reviewed commit with explicit destination URL/project/client key. Configure SPA fallback, HTTPS, deep links, cache/version handling and server-only secrets. Use an approved restricted preview because it accesses real restored data. Configure Auth Site URL/allowed redirects for the selected host and retain working recovery-code template. | App works from a second device without the developer laptop/Vite. Its browser calls only the intended destination; login, code recovery and private file access work on that host. No service-role/API secrets in client assets. |
| 6. Focused launch acceptance | Execute the six-workflow checklist below with approved test records and controlled recipients. Use synthetic local tests for failure/destructive cases; narrowly scoped real-data acceptance only where needed. No employee-wide test messages. | Recorded PASS/FAIL per workflow and role, no required blocker hidden by a successful login. Required backend state changes, notification outcomes and file access verified. Fix ignored email invocation errors in truck workflows and inspection status that equates enqueue with delivery; show useful partial-failure feedback. Failed cases fixed and rerun selectively. |
| 7. Reconcile and prepare recovery | Compare destination against the retained baseline with an explicit list of intentional password, role, schema and acceptance-record changes. Preserve IDs/relationships/files/payroll records. Retain a private recovery point for the finalized destination and frontend configuration, plus originals. Verify restore instructions and archive readability. | No unexplained business-data differences. Payroll/Auth/files recoverable outside Git; secrets stored privately. Temporary test data/roles resolved by approval, not blanket cleanup. Rollback operator and exact procedure recorded. |
| 8. Approve and cut over | Present release commit, passing workflow results, chosen destination/host, deferred scope, backups and rollback plan. Obtain explicit production authorization. Coordinate a short no-dual-writes window; snapshot DNS/current deployment. Switch domain/frontend, enable the approved notification dispatcher and perform production smoke checks. | Production domain serves pinned build; real login/jobs/file access work; first controlled notification succeeds; source receives no new app writes. No default full recopy. Abort if unexplained source changes or failed gates emerge. |
| 9. Observe, then retire Lovable | Named operator checks Auth errors, function failures, email failures/DLQ and key workflows during roughly one week of rollback availability. Keep source read-only/unused and originals recoverable. | Stable operation and payroll recovery archive confirmed. Explicit cancellation approval obtained afterward. Cancellation is separate from DNS cutover and never automatic. |

## Deployment and dispatcher details

Initial allowlist in scripts/rehearsal-deploy-functions.sh:

- send-transactional-email, process-email-queue, handle-email-unsubscribe
- request-truck, decide-truck-request
- submit-accident-report, submit-safety-violation, request-safety-inspection

The suppression webhook is an additional reviewed deployment once Postmark handling
is implemented; the current script does not deploy it. Onboarding functions remain
paused. Do not use deploy-all or rely on the source project in supabase/config.toml.

A queue alone does not send email automatically. After the controlled manual worker
proof, install one minimal authenticated dispatcher using the chosen supported
scheduler. Keep it disabled until release activation; test in a synthetic environment
first. Record cadence, credential ownership and an off switch; perform a bounded authorized
destination dispatch test before launch or during cutover smoke checks. Do not recreate
unneeded celebrations or other source schedules. Destination scheduler run history
starts empty; never import source cron history or clear source history. Keep the
first legitimate destination run records once execution begins.

The worker keeps existing bounded retry/DLQ behavior. An uncertain provider response
can cause a duplicate; document that limitation rather than introducing a new
tracking system. Check errors from queue reads/log writes so a failing worker cannot
be accepted merely because its HTTP response is 200.

For workflow tests, inspect template-recipient overrides and restored role/settings
fan-out first. Keep delivery off while checking enqueue behavior. Use explicit
controlled-recipient gates for end-to-end delivery; do not silently redirect real
business mail and mark it delivered. Reconcile/remove only identified test-owned
messages with the appropriate authorization. Verify each required workflow enqueues,
not only a manually constructed notification.

Fresh empty queues do not authorize dropping historical evidence: source/exported
queue state and mail logs remain archived. Old pending notifications are not copied
into active queues. Before switching delivery on, inspect any new acceptance traffic
and ensure only approved messages will be processed.

## Six-workflow acceptance checklist

| Workflow | Minimum launch proof |
| --- | --- |
| Login/recovery | Existing employee and authorized admin/foreman can sign in on the independent host; recovery code permits password update; public signup remains off; unauthorized admin access denied. |
| Jobs | Authorized role reads and saves an approved job change; read-only role cannot perform that change. Required updates appear for another permitted session. |
| Files | Existing plan PDF and photo open from destination; permitted upload/download works; forbidden cross-user/role access fails; private URLs work without source/Lovable access. |
| Time off | Request → decision → persisted status and intended notification. Other employees cannot approve or access unauthorized records. |
| Trucks | Request → office/admin decision → dispatch outcome, with correct recipient notification. Failure does not masquerade as successful scheduling/delivery. |
| Safety reports | Incident/violation and attachment persist; correct authorized reviewers can read them; required notification arrives. Include inspection request if exposed at launch. |

Do not create an unrelated new feature test program. These are launch gates around
what users need. Reuse the existing tests and evidence, rerunning when code or hosted
configuration changes invalidate them.

## Rollback and launch decision

Stop cutover for wrong backend/credentials, broken login, unauthorized data access,
missing critical records/files, or failing essential writes/notifications. Before
any destination writes, reverting the frontend/DNS may be sufficient after checking
state. After destination writes, pause writes and reconcile those records/files
before directing users back to source. Never overwrite newer destination work with
an old backup. Prefer fixing forward when safer; record the decision and operator.

The deadline does not waive these gates. If they cannot pass by October 21, report
what is blocked and keep the currently approved system available. Do not represent
new engineer onboarding as working while it remains deferred.

## Review record

A fresh agent reviewed the initial sequence with concise relevant context and no
conversation history, then inspected the repository. It found missing release gates:
non-atomic unsubscribe, recipient fan-out, ignored enqueue failures, deployed worker
authorization, final commit pinning, dispatcher acceptance, deferred onboarding UI
and operational rollback. All were incorporated above. It also flagged stale status
docs; this plan is the current completion checklist and the companion scope/readiness
notes point here. Second review approved this as an execution checklist (not release authorization),
with one final correction: explicitly test denial of a valid ordinary-user JWT by
the deployed worker with no queue/log side effects. That gate is included in step 2.
