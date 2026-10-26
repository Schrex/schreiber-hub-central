# Jobs status lifecycle release review

Status: **released 2026-10-26** (#31, spec #28). See "Release record" below.
Target backend is **acgqjjbrnkmeazswdnzp (PRODUCTION)**; never the `supabase/config.toml` project.

## Change

`supabase/migrations/20261026010000_jobs_status_lifecycle.sql` adds `jobs.completed_at`,
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

## Release record (2026-10-26)

| Step | Result |
| --- | --- |
| Release PR | #41 `develop` → `main` at `8232a07`; Verification [40378797799](https://github.com/Schrex/schreiber-hub-central/actions/runs/40378797799) green |
| Before checks | 7 jobs, 0 complete; new columns absent; `jobs_seed_contact_slots=O, update_jobs_updated_at=O` |
| Migration | Applied via Supabase SQL editor, file wrapped in `BEGIN; … COMMIT;`; editor text hash-matched `main` |
| After checks | 3 columns, `jobs_completion_matches_status`, `jobs_hold_reason_matches_status`, `jobs_status_lifecycle=O`; counts unchanged |
| Edge function | `request-truck` v11 → v12 from `8232a07`, `verify_jwt` true |
| Frontend | Candidate [40381792517](https://github.com/Schrex/schreiber-hub-central/actions/runs/40381792517), digest `279858a4…0acc`; deploy [40382959483](https://github.com/Schrex/schreiber-hub-central/actions/runs/40382959483) verified; deployment `a4ea3102-ddc7-4084-963f-f1e62474c6df`; live build-info `8232a07` |
| Smoke test | Throwaway job: Complete → Archive; DB `completed_by` = signed-in owner (trigger); Reopen cleared fields, no Undo; job deleted by SQL (the app has no delete-job UI). Final: 7 jobs, 0 complete |
| Rollback target | `recover` to `6a6e77f0-9371-4e44-a028-6c6ae58ae42c` (`abdde98`); old frontend works on the new schema |

Not verified in production: the `request-truck` rejection of non-active jobs; on-hold and
archive search with real data. The first preflight failed because docs listed a stale live
deployment UUID; corrected from the deployments ledger and live build-info.
