# Jobs status lifecycle release review

Status: candidate only; production execution is not authorized (#31, spec #28).
Target backend is **acgqjjbrnkmeazswdnzp (PRODUCTION)**; never the `supabase/config.toml` project.

## Change

`local/candidate-migrations/20261026010000_jobs_status_lifecycle.sql` adds `jobs.completed_at`,
`jobs.completed_by` (auth users, `ON DELETE SET NULL`), `jobs.hold_reason`, two check
constraints and the `jobs_status_lifecycle` `BEFORE INSERT OR UPDATE` trigger. No backfill, no
new index, RLS unchanged. Local proof: `bun run test:local:jobs-status`.

## Release order

The Jobs frontend (Active/Archive tabs, status sheet, archive search) selects and writes
`completed_at`, `completed_by` and `hold_reason`; against a database without them its job
queries fail. Promote and apply this candidate migration in production, and run the "After
applying" checks, **before** deploying that frontend. Never deploy the frontend first.

## Before applying

1. Count existing complete rows; they keep a null `completed_at` ("Date unknown"):
   `SELECT count(*) FROM public.jobs WHERE status = 'complete';`
2. The check constraints validate existing rows. The new columns start null, so no existing row
   can violate them; confirm the columns do not already exist.
3. Confirm the existing `updated_at` trigger is enabled (`tgenabled = 'O'`):
   `SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.jobs'::regclass AND NOT tgisinternal;`

## After applying

- Re-run the trigger query: `jobs_status_lifecycle` and `update_jobs_updated_at` both `O`.
  Production trigger state has differed from migration history before.
- Service-role / Edge function writes that complete a job store a null `completed_by` (shown as
  "Unknown"); this is expected.

## Release checklist

Each step lists its check and its way back. Do not start a step until the previous step's check
passes. Record results (who, when, run IDs, query output) in the release PR or
`DEVELOPMENT_PROGRESS.md`. Owner authorization is required before Phase 2 and before Phase 4.

Why this order: the migration is additive, so the **current** frontend keeps working on the new
database. The new frontend does not work on the old database. Database first makes every
rollback below cheap.

### Phase 0: Prepare (no production writes)

- [ ] **Scope.** `git log --oneline origin/main..origin/develop` lists everything that ships. It
      is more than Jobs (CI and dev-environment commits too); review the whole release diff.
- [ ] **Usage.** Confirm who is using the app (Supabase Auth, users' last sign-in). Pick a
      window with no office edits in progress. Do not assume "nobody is using it".
- [ ] **Other candidates.** `local/candidate-migrations/` holds other files. Confirm which are
      already in production and that only `20261026010000_jobs_status_lifecycle.sql` is applied
      in this release.
- [ ] **Read-only baseline queries** in production, saved: the three "Before applying" queries
      above.
- [ ] **Current frontend.** Record the live deployment UUID and build-info SHA (see
      `docs/production-baseline.md`). This is the frontend rollback target.
- [ ] **Edge function source.** Record the currently deployed `request-truck` version so it can
      be redeployed.
- [ ] **Tell office staff** what changes: Change status, the future-assignment cleanup (deletes
      real rows; Undo does not restore them), and Schedule carry-forward skipping inactive jobs.
- [ ] **OPEN DECISION: how SQL is applied.** No repo runbook exists for applying a migration to
      production. Choose and write down the method (for example, the Supabase SQL editor with
      the file wrapped in `BEGIN; … COMMIT;`). Name `acgqjjbrnkmeazswdnzp` explicitly; never
      `supabase db push`.

### Phase 1: Git (merging to main does not deploy)

- [ ] **Promotion PR into `develop`:** move the file from `local/candidate-migrations/` to
      `supabase/migrations/`, and update `scripts/prepare-local.mjs` (it copies the candidate by
      name), the codebase map and this file's status line. All five verify groups pass.
- [ ] **Release PR `develop` → `main`**, owner approved.
- [ ] Verification passes on the exact `main` SHA (`verify.yml` runs on push to main).

### Phase 2: Database (owner authorization)

- [ ] Re-run the baseline queries immediately before applying; they must match Phase 0.
- [ ] Apply the single migration file in one transaction against `acgqjjbrnkmeazswdnzp`.
- [ ] **Check:** the "After applying" trigger query shows `jobs_status_lifecycle` and
      `update_jobs_updated_at` both `O`; the three columns exist; the complete-row count is
      unchanged.
- [ ] **Check:** the current (old) frontend still loads `/jobs` and a job page.
- [ ] **Way back:** a failed apply leaves no change, because Postgres DDL is transactional.
      After a successful apply, `ALTER TABLE public.jobs DISABLE TRIGGER jobs_status_lifecycle`
      is instant. Dropping the columns loses data written since; avoid that once Phase 4 is live.

### Phase 3: Edge function (independent; reads only the existing `status` column)

- [ ] Deploy only `request-truck` to `acgqjjbrnkmeazswdnzp` (method to be confirmed alongside
      the SQL method).
- [ ] **Check:** a truck request for an active job still succeeds. The non-active rejection has
      never run anywhere (the Edge runtime is disabled locally); test it with the Phase 5
      throwaway job.
- [ ] **Way back:** redeploy the version recorded in Phase 0.

### Phase 4: Frontend (owner authorization; `docs/manual-frontend-operations.md`)

- [ ] **Production candidate build** on the exact main SHA; record the `release.json` SHA256.
- [ ] Owner approves the SHA, run and digest.
- [ ] Release operation `deploy`: `plan` → `preflight` → `execute` (`DEPLOY <full SHA>`,
      previous deployment UUID from Phase 0, recovery reference).
- [ ] **Check:** live build-info shows the new SHA; `/jobs` loads both tabs.
- [ ] **Way back:** operation `recover` to the Phase 0 deployment UUID. The old frontend works on
      the new database, so recovery needs no database change.

### Phase 5: Production smoke test (real data, so touch only a throwaway job)

- [ ] As an office or admin user, create `ZZ RELEASE TEST <date>` with no crew and no
      assignments.
- [ ] Mark it Complete. **Check:** it appears in Archive. In the database, `completed_by` is
      your user and `completed_at` is set.
- [ ] Reopen it. **Check:** back in Active; completion fields cleared.
- [ ] Optional: on hold with a reason, then active again (the reason clears).
- [ ] Delete the throwaway job.
- [ ] Spot-check: an existing complete job shows "Date unknown" in Archive; the Dispatch picker
      lists active jobs only.

### Phase 6: Record (the release is done only after this)

- [ ] Update `docs/production-baseline.md`: new deployment UUID, build-info SHA, migration
      applied (date, method, who).
- [ ] Set this file's status line to applied, with links to the evidence.
- [ ] Note anything still unverified, such as the `request-truck` rejection if it was not
      exercised.

Done means production evidence (trigger query output, live build-info, smoke-test result,
recorded rollback targets), not local or CI results.
