# Independent launch scope — 2026-10-20

> Historical migration record. For current production identity and operating rules,
> use [production baseline](production-baseline.md). Do not rerun migration steps
> or treat earlier pending-state descriptions as current status.

**Current execution checklist:** [migration completion plan](migration-completion-plan.md).
This scope document's earlier implementation notes are historical. On October 20,
the Postmark adapter/worker path was added locally and tested; Auth SMTP/code recovery
worked with user confirmation; fresh destination email queues were installed empty.
Functions are not yet deployed and app mail is inactive. See the completion plan for
remaining release gates and the fresh-agent review.


This supersedes the earlier all-features launch plan. The user selected login,
jobs, files, time off, truck requests and safety reports as essentials. AI, SMS,
speech and celebrations email are deferred; preserve their records and files.
Google is not a launch prerequisite: existing-account password login and recovery
must work independently. Deferred entry points still need explicit UI/backend
controls; they are not yet disabled throughout the application.

## Data baseline

The user reports the source app has been unused for three months with no data
changes. Use the already restored and verified hub-rehearsal copy as the migration
baseline. This is a user-reported source inactivity claim, not a fresh source query.
Do not repeat the full export/import automatically and do not build change capture.
Keep the original private exports recoverable. Final reconciliation must distinguish
the approved rehearsal password/admin-role changes and reviewed database fixes from
unintended changes. If new source writes are discovered, resolve them before cutover.

## Essential workflow dependency map

Inspected current branch code on 2026-10-20. These are repository dependencies,
not a claim that functions have been deployed or that hosted workflows pass.

| Workflow | Runtime path | Remaining launch work |
| --- | --- | --- |
| Login | Supabase Auth, profiles, user_roles; Auth.tsx | Existing password login observed. Configure destination Auth SMTP and reset redirects; prove recovery and account setup. Managed new-user trigger still needs hosted installation/verification. Keep public signup off. |
| Jobs | Direct database reads/writes under RLS; job detail components | Reads observed. Exercise authorized edits and role boundaries. Preserve manual scope/brief entry while disabling AI extraction. |
| Files | Supabase Storage with signed URLs in job file components | One photo download matched archive. Complete plan/PDF and permitted upload checks; resolve two known synthetic accident-photo failures. Safety.tsx stored media URLs need private destination handling. |
| Time off | time_off_requests direct writes; send-transactional-email on approval | Synthetic browser workflow passes. Prove hosted request/decision and required notification using controlled acceptance records/recipients. |
| Truck requests | request-truck, decide-truck-request; jobs, truck_requests, dispatch_orders; send-transactional-email | Deploy reviewed functions to destination, test request/decision and failure handling. Inspect settings for destination recipients and app links. |
| Safety reports | submit-accident-report, submit-safety-violation, request-safety-inspection; report tables/files; send-transactional-email | Deploy reviewed functions; prove report persistence, file access, role limits and notification. Inspection success must distinguish email enqueue from actual delivery. |

## First implementation batch: independent application email

The current process-email-queue imports @lovable.dev/email-js and requires
LOVABLE_API_KEY. This is a shared blocker across the essential workflows.
The existing send-transactional-email function uses enqueue_email, suppression
records, unsubscribe tokens and email_send_log; deploying the function alone is
insufficient without the queue/RPC dependencies.

1. Bring across only reviewed email transport code/tests from
   codex/independent-integration-preparation. Do not merge the entire older branch
   over this restore checkpoint. That selective import has since been completed; remaining integration gates are in the completion plan.
2. Connect Postmark to the existing worker while preserving retries, dead-letter
   handling, suppression and send logging. No new delivery-tracking service.
   Document the existing possible duplicate-send behavior on uncertain outcomes.
3. Keep Auth on Supabase SMTP, separate from the app queue. Do not start consuming
   archived Auth mail or replay old business notifications. Preserve archived state;
   review pending queue contents privately before any activation.
4. Adapt or explicitly replace the Lovable-authenticated suppression webhook;
   retain working unsubscribe behavior. Synthetic tests first, then one controlled
   destination delivery. No bulk sends or scheduled workers during preparation.

Postmark DNS and a recovery delivery were previously verified in the separate
email-test project. That does not prove hub-rehearsal SMTP or application delivery.
Credentials must be entered privately and never included in frontend configuration.

## Destination deployment boundary

The initial business-function set is request-truck, decide-truck-request,
submit-accident-report, submit-safety-violation and request-safety-inspection,
plus the reviewed email enqueue/worker/unsubscribe/suppression path. Review
create-employee and convert-employee-contact with the new-user Auth trigger for
owner-managed onboarding; these currently create accounts rather than email invites.
Safety-talk completion and attendance are separate from basic incident reports:
preserve existing content and do not advertise unavailable talk integrations.

supabase/config.toml still points to the SOURCE project. Never use an implicit
project deployment or deploy-all command. Any deployment must explicitly target
acgqjjbrnkmeazswdnzp with reviewed gateway/auth settings and destination secrets.
Do not deploy optional AI/SMS/speech/celebrations functions or activate their schedules.
Destination scheduler execution history starts empty; source history is untouched.

## Remaining sequence

1. Implement and synthetically validate the required email path and function set.
2. Apply explicit launch controls for deferred features; retain manual workflows
   and existing content. Complete private media compatibility.
3. Configure independent frontend hosting and Auth URLs using an existing approved
   account. Hosting provider/account is not established by this code inspection.
4. Run the six essential workflows end to end against the destination with approved
   test records and controlled recipients. Check access boundaries and Realtime only
   where those workflows depend on it. Record remaining defects, not just login success.
5. Reconcile the existing baseline, review the release diff and obtain explicit
   production cutover approval. No automatic new export or change-capture system.
6. Keep Lovable available for rollback for about a week after cutover. A rollback
   after destination writes needs reconciliation; switching DNS alone loses those
   writes. Confirm the recoverable payroll archive before separately authorizing
   cancellation. Cancellation and paid provisioning are not authorized here.
