# Backend map

Part of the [codebase map](README.md). Last checked @ `f026a29`.

## Tables by domain

Source of truth: `supabase/migrations/` (78 applied files, mostly Lovable UUID names) and
`src/integrations/supabase/types.ts`. Most tables have an `update_updated_at_column` trigger.

**Identity / HR**
- `profiles` (1 per auth user: display_name, email, is_active), `user_roles` (user_id, role).
- `employee_contacts` — directory + HR record (manager self-FK, `converted_user_id` → login).
  Sensitive columns (SSN, bank, licence, emergency, termination) are **not** selectable by
  `authenticated`; use RPC `get_employee_contact_sensitive(_id)`. Directory via
  `list_employee_directory` / view `employee_contacts_directory`. Sync triggers keep it aligned
  with `profiles`.
- Pay: `positions` (+ view `positions_public`), `employee_positions`, `benefit_types`,
  `employee_benefits`, `employee_compensation_history` (generated `total_compensation`),
  `pay_audit_log` (filled by `log_pay_change` triggers), `validate_*` triggers.
- Other HR: `time_off_requests`, `performance_reviews`, `referrals`, `org_chart_nodes`,
  `handbook_documents`, `celebration_log`, onboarding (`onboarding_document_templates` →
  `onboarding_documents` → `onboarding_signatures`).

**Jobs / estimating**
- `jobs` → `job_contacts`, `job_contact_template_slots` (seeded by trigger on insert),
  `job_estimates`, `job_exclusions`, `job_notes`, `job_permits`, `job_photos`, `job_plans`,
  `job_scope_items`, `job_submittals`, `job_unit_pricing`, `dig_tickets`.
- `jobs.lookahead_grid_enabled` (default false) gates the task look-ahead. Tables, local
  candidate only: `lookahead_plans` → `lookahead_tasks` → `lookahead_task_days`, plus
  `lookahead_plan_holidays`, `lookahead_acks`, `lookahead_changes`, `lookahead_views`,
  `lookahead_import_runs`. The live published plan is readable by any signed-in user.
  Drafts, superseded versions, and grid writes are office/admin. `publish_lookahead_upload`
  replaces the live plan from an MSPDI upload and turns the job flag on. No cost or
  rate columns. Not applied to production.
- `jobs` status lifecycle (`supabase/migrations/20261026010000_jobs_status_lifecycle.sql`; applied in production 2026-10-26):
  columns `completed_at`, `completed_by` (→ auth users, `ON DELETE SET NULL`), `hold_reason`;
  checks `jobs_completion_matches_status`, `jobs_hold_reason_matches_status`; `BEFORE INSERT OR
  UPDATE` trigger `jobs_status_lifecycle` sets `completed_by = auth.uid()` on entering complete
  (null for service role), pins it while complete, defaults `completed_at` to now, rejects a
  future New York date, nulls completion fields / `hold_reason` outside complete / on_hold.
  No backfill. Release notes: `docs/jobs-status-release.md`.
- Bids: `bid_phases` → `bid_items` → `bid_item_activities` / `bid_item_materials`; `activity_equipment`.

**Field ops** — `crews`, `schedule_assignments`, `dispatch_orders`, `truck_requests`,
`equipment_items`, `equipment_rentals`, `shop_reservations`, `vendors`, `clothing_items`,
`clothing_orders`, `whiteboard_tiles`, `app_settings`.

**Safety** — `toolbox_talks` → `toolbox_talk_sessions` → `toolbox_talk_attendees`
(token RPC `get_attendee_by_token`), `safety_rules`, `safety_inspections`, `safety_violations`,
`accident_reports`, `swpppp_reports`.

**Notifications / email**
- `notifications` written by `notify_user` / `notify_role` from `notify_*` triggers
  (time off, trucks, clothing, rentals, schedule, safety, accidents, swpppp).
- Email: `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`;
  pgmq queues `auth_emails`, `transactional_emails` (+ `_dlq`) with RPC wrappers
  `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`.

## Authorization

- Enum `app_role`: employee, foreman, office, admin. Stored in `user_roles`.
- `has_role(_user_id, _role)` — SECURITY DEFINER, avoids RLS recursion. `get_primary_role` → highest.
- `handle_new_user` trigger on `auth.users` creates profile + default `employee` role.
- Only admins write `user_roles`; users read own roles/profile.
- RLS on every table. Patterns: owner `auth.uid() = user_id`; staff
  `has_role(auth.uid(),'office'|'admin')` (sometimes + foreman); ~21 `USING (true)` reads for
  reference data.

## Storage

15 buckets, all private except `talk-media`. Private: `accident-photos`, `handbook`,
`job-contracts`, `job-estimates`, `job-photos`, `job-plans`, `job-submittals`,
`onboarding-signed`, `onboarding-templates`, `permits`, `safety-violation-photos`,
`shop-waivers`, `swpppp-reports`, `talk-audio`.
Policy pattern: authenticated SELECT by bucket; writes limited to foreman/office/admin (job
files), office/admin (handbook), admin (onboarding templates); some owner folders via
`storage.foldername(name)[1]`.

## Edge functions

`supabase/functions/` (17 + `_shared/`). Typical auth: verify caller JWT, then role lookup.
Secrets listed by name only. `verify_jwt` flags in `supabase/config.toml`.

| Group | Functions | Notes |
| --- | --- | --- |
| Parked (in `parked/edge-functions/`, not deployed) | categorize-document, extract-foreman-brief, extract-scope-from-contract, generate-toolbox-talk, suggest-safety-topic, notify-talk-attendees | AI + crew SMS; see `parked/README.md` |
| Speech | speak-toolbox-talk, transcribe-toolbox-talk | Deepgram/ElevenLabs — out of scope, secrets removed |
| Workflows → email | request-truck, decide-truck-request, request-safety-inspection, submit-safety-violation, submit-accident-report, complete-safety-talk | enqueue via send-transactional-email |
| Employees | convert-employee-contact, create-employee | create-employee needs candidate RPCs; disabled in prod |
| Email pipeline | send-transactional-email, process-email-queue (Postmark), handle-email-suppression (Postmark webhook), handle-email-unsubscribe | Postmark only (`EMAIL_PROVIDER=postmark`). Controls: `EMAIL_DELIVERY_ENABLED`, `EMAIL_DELIVERY_MODE`, `EMAIL_ALLOWED_RECIPIENTS` |
| Scheduled / inbound | daily-celebrations (bearer secret), inbound-swpppp-email (webhook secret) | |

`request-truck` returns 409 for jobs that aren't `active` (static check only; runtime unverified).

`_shared/`: Postmark send + suppression, `profileEmails.ts`, `transactional-email-templates/`.

## Migration workflow

- `supabase/migrations/` = applied production history. Never edit or replay.
- `local/candidate-migrations/` = 13 unapplied candidates (time-off permissions, attendance RLS
  fix, safety notification dedup, contact sync, job-contact seed dupes, queue/service grants,
  accident-photo storage policy, inactive email dispatcher, employee creation, look-ahead grid).
  Promotion needs release review + explicit authorization; applied one file at a time to a
  named project (see `docs/add-employee-release.md`).
- `local/hr-bootstrap.sql` recreates pay/benefit tables no migration creates — local only.
- New schema work: add a candidate migration in `local/candidate-migrations/` and wire it into
  `scripts/prepare-local.mjs` if it should run locally.

## Local backend

- `scripts/prepare-local.mjs` builds `.local-backend/supabase/`: copies migrations (rejects
  `net.http_`, `cron.schedule`, vault writes), stubs the historical employee-account seed and
  the Cloud-owned realtime migration, injects hr-bootstrap + an ordering fix, copies 3
  candidates (time-off permissions, employee creation, look-ahead grid), `local/config.toml`,
  `local/seed.sql`. No Edge functions.
- Ports: API 55321, DB 55322 (shadow 55320), Studio 55323, mail capture 55324. Postgres 17.
  Realtime, edge runtime, analytics disabled.
- `local/seed.sql`: truncates everything; users `employee@`, `other@`, `admin@example.test`
  (shared local password in `local/README.md`). No foreman/office seed users — tests assign roles.
- `scripts/local-backend.mjs` only accepts the loopback API URL.

## Backend tests (`bun run verify:backend`)

| Script | Checks |
| --- | --- |
| `local:audit-schema` (`schema-audit.mjs`) | Schema shape |
| `test:local` (`local-smoke.mjs`) | Time-off privacy, forged ownership, approve flow |
| `test:local:permissions` | Time-off tamper / self-approval denied |
| `test:local:hr` | Benefits/comp admin-only, own-row reads, audit rows |
| `test:local:storage` | Job-file bucket read/write by role |
| `test:local:roles` | Per-role uploads, salary privacy, no self-promotion |
| `test:local:employee` | create-employee handler + RPC races |
| `test:local:jobs-status` | Jobs lifecycle trigger/checks as office, employee, service role |
| `test:local:lookahead` | Published look-ahead read by an employee; draft hidden; task insert denied; holiday/weekend marks rejected |
| `test:local:access` (`local-access-policy.mjs`) | UI access rules (`src/lib/accessRules.ts`) never allow more than RLS: probes each table-linked rule (81 checks) per role + assigned/unassigned foreman; wider RLS must be a recorded `narrower`. Tables only, no storage buckets; `ui-only` rules listed, not probed |

Run individually: `local-accident-photo-replacement.mjs`, `local-storage-api-acceptance.mjs`,
`local-private-talk-media-acceptance.mjs`, Python `local-*-triggers.py` / `*-activation.py`.
`local-grant-proposal.py` needs the private export archive (outside repo).
