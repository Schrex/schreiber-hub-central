# Migration trigger groups

All 70 public business triggers are accounted for below. The managed Auth new-user
trigger and queue/scheduler hooks are separate migration work; they are not included
in these 70. Production remains untouched. Real-data rehearsal stays isolated.

| Group | Count | Verified rehearsal state | Test work |
| --- | ---: | --- | --- |
| Timestamps | 48 | Enabled | Local tests passed; hosted state verified |
| Validation | 5 | Enabled | Local tests passed; hosted state verified |
| Pay audit | 3 | Enabled | Local tests passed; hosted state independently verified |
| Contact/profile sync | 4 | Enabled | Candidate installed; hosted state verified |
| Job-contact setup | 1 | Enabled | Candidate installed; hosted state verified |
| Notifications | 9 | Enabled | Candidate tested (45 cases); hosted state verified |

## Remaining trigger inventory

### Pay audit

| Table | Trigger | Function |
| --- | --- | --- |
| `employee_benefits` | `audit_employee_benefits` | `log_pay_change` |
| `employee_compensation_history` | `audit_employee_comp_history` | `log_pay_change` |
| `employee_positions` | `audit_employee_positions` | `log_pay_change` |

### Contact/profile sync

| Table | Trigger | Function |
| --- | --- | --- |
| `employee_contacts` | `sync_employee_contact_name_trg` | `sync_employee_contact_name` |
| `employee_contacts` | `trg_sync_contact_to_profile` | `sync_contact_to_profile` |
| `employee_contacts` | `trg_sync_employee_contact_display_email` | `sync_employee_contact_display_email` |
| `profiles` | `trg_sync_profile_to_contact` | `sync_profile_to_contact` |

### Job-contact setup

| Table | Trigger | Function |
| --- | --- | --- |
| `jobs` | `jobs_seed_contact_slots` | `trg_seed_job_contact_slots` |

### Notifications

| Table | Trigger | Function |
| --- | --- | --- |
| `accident_reports` | `notify_accident_report_trigger` | `notify_accident_report` |
| `clothing_orders` | `trg_notify_clothing_orders` | `notify_clothing_order_changes` |
| `equipment_rentals` | `trg_notify_equipment_rentals` | `notify_equipment_rental_changes` |
| `toolbox_talk_attendees` | `trg_notify_safety_talk_attendee` | `notify_safety_talk_attendee` |
| `safety_violations` | `trg_notify_safety_violation` | `notify_safety_violation` |
| `schedule_assignments` | `trg_notify_schedule_assignment` | `notify_schedule_assignment` |
| `swpppp_reports` | `trg_notify_swpppp_report` | `notify_swpppp_report` |
| `time_off_requests` | `trg_notify_time_off` | `notify_time_off_changes` |
| `truck_requests` | `trg_notify_truck_request` | `notify_truck_request_changes` |

## Boundaries

Synthetic tests run only in the disposable local Docker database and roll back.
Public-table tests share an advisory lock to avoid interference between agents.
Passing these tests does not enable hosted triggers or certify complete app behavior.
Keep signup, Email, Data API and workers off until the remaining migration gates pass.

## Parallel test results — 2026-10-19

- Pay audit: `scripts/local-pay-audit-triggers.py` verifies source function/security
  and all three bindings; nine complete INSERT/UPDATE/DELETE audit payload and caller
  checks, nine forced audit-sink failures with business/audit rollback, and three
  no-JWT cases with NULL actor attribution. Local state restored.
- Contact/profile sync and job setup: `scripts/local-sync-setup-triggers.py` verifies
  six functions (including the seeding helper) and five bindings; normalization,
  linking, finite roundtrip, active templates, repeat seeding and null/empty material
  matching tested. Full trigger definition/state fingerprint and fixture rollback pass.
- Notifications: `scripts/local-notification-triggers.py` verifies eleven functions
  and nine event bindings; 41 recipient, event gating, status, link and metadata cases.
  Outbound hooks disabled transactionally; no SMTP or hosted calls. Fixtures rolled back.

### Findings requiring review before activation

1. Contact edits to first/last name or work/personal email alone can leave the linked
   profile stale: the UPDATE OF trigger watches the original SET columns, not fields
   modified by an earlier normalization trigger.
2. Profile display-name edits can be overwritten by the contact's structured name on
   roundtrip. Contact active status does not synchronize back to the profile.
3. Two active job-contact templates with the same category/role/material produce two
   slots for a new job. Sequential repeats deduplicate existing rows, but NOT EXISTS
   does not deduplicate the initial source batch. Actual exported templates have not
   been scanned for this condition; concurrent seeding is not certified.
4. A President who also has admin role receives two safety-violation notifications.
   This is existing source behavior, reproduced without changing it.

Passing characterization checks means the observed source behavior is reproduced,
not that these gaps are fixed. Keep the affected groups disabled pending a decision
on preserving behavior versus separately reviewed fixes. Pay-audit activation can
be prepared independently. These bounded local tests do not certify complete RLS,
foreign-key workflows, hosted execution, Realtime or outgoing email delivery.

## Candidate fixes prepared — 2026-10-19

Three candidates are prepared, tested locally, and **not installed** in rehearsal:

- `local/candidate-migrations/20261019233000_safety_notification_recipient_dedup.sql`:
  prevents duplicate safety notifications for President/admin overlap. Candidate suite
  passes 45 cases after reproducing the source duplicate.
- `local/candidate-migrations/20261020001000_contact_sync_effective_changes.sql`:
  watches effective normalized name/email/link changes. Replacement trigger stays disabled.
- `local/candidate-migrations/20261020001100_job_contact_seed_duplicates.sql`:
  collapses identical template definitions and rejects conflicting payloads atomically.
  Job-row and template locks protect the operation; concurrent execution remains untested.

Run the notification and sync/setup scripts with `--candidate` for rollback-only tests.
Both suites restore original functions, permissions and trigger state. Job setup tests
include missing-job rejection and unchanged rows on a conflicting-template failure.

Structured contact-name authority and profile-controlled active status remain unchanged,
consistent with the current frontend. These preserved semantics do not require a new
migration behavior decision. Actual source templates still need conflict assessment
before enabling seeding. No existing records are rewritten. Next is guarded rehearsal
installation and independent verification; all 14 remaining triggers stay disabled.

## Isolated fixes installed — 2026-10-19

All three candidates are now installed in hub-rehearsal and independently verified.
Function bodies/security match, direct anon/authenticated EXECUTE remains denied,
and the exact replacement contact trigger is disabled. The other 69 trigger definitions
and states are unchanged. The operator installation passed its template-conflict guard.
There are still 56 enabled and 14 disabled triggers. Next is guarded activation of
these reviewed remaining groups, then independent verification; full hosted acceptance
remains outstanding. No production deployment or candidate promotion occurred.

## Final business-trigger state — 2026-10-19

All 70 reviewed business triggers are enabled and their exact definitions independently
verified. Earlier disabled-state notes above are historical. Login, Data API, email and
workers must stay OFF pending Storage permissions, Auth setup and hosted acceptance.
No Auth new-user trigger or scheduler/queue hooks have been activated by this milestone.
