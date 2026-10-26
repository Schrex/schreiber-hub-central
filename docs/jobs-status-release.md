# Jobs status lifecycle release review

Status: promoted to `supabase/migrations/` for release; **not yet applied in production** (#31, spec #28).
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
