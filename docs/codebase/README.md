# Codebase map — overview

Last checked against `develop` @ `f026a29` (2026-10-25). Update this map when routes, tables,
Edge functions, environments or release steps change. Detail files are read on demand:

- [frontend.md](frontend.md) — routes, auth/roles, data access, features → files, UI, tests
- [backend.md](backend.md) — tables, roles/RLS, storage, Edge functions, migrations, local backend
- [release.md](release.md) — environments, release flow and guards, CI, docs inventory

## What this is

Schreiber Hub: internal web app for Schreiber Excavating (construction). Employees, foremen,
office staff and admins use it for jobs, crew scheduling, dispatch/trucking, safety (toolbox
talks, inspections, accident reports), time off, HR/pay, perks and directories.
Live at app.schreiberexcavating.com. Contains employee PII and compensation (see SECURITY.md).

## Stack

- Frontend: React 18 + Vite + TypeScript, shadcn/ui (Radix) + Tailwind 3, react-router.
  Direct `supabase.from()` calls in components; React Query is installed but unused.
- Backend: Supabase (Postgres 17, Auth, Storage, Edge functions in Deno). Authorization is
  enforced by RLS + `has_role()`; client role checks are UI gating only.
- Hosting: Cloudflare Pages (static upload) + independent Supabase project `acgqjjbrnkmeazswdnzp`.
  Originally built on Lovable; Lovable hosting/sync is retired but traces remain.
- Tooling: Bun 1.3.14, Node from .nvmrc, Vitest, Playwright, ESLint, pinned Supabase CLI 2.121.0
  via npx, Docker for the local backend.

## Folder map

| Path | Contents |
| --- | --- |
| `src/pages/` | One default-export page per route |
| `src/components/<feature>/` | Feature components (jobs, schedule, safety, home, dispatch, whiteboard…) |
| `src/components/ui/` | shadcn primitives |
| `src/hooks/` | `useAuth` (session + roles), `useResumeRefresh`, `useWeather` |
| `src/lib/` | helpers: `launchScope`, `talkMedia`, `resumableUpload`, `weather`, `affectedRows` (0-row write = permission error), `jobs` (NY today, job sort/grouping, badge map, search escaping) |
| `src/integrations/` | Generated Supabase client + `types.ts`, Lovable auth (do not hand-edit) |
| `src/test/` | Vitest unit tests (some colocated `*.test.tsx` too) |
| `e2e/` | Playwright specs (11, `.mjs`) |
| `supabase/migrations/` | Applied production migration history (79) — never edit |
| `supabase/functions/` | 24 Edge functions + `_shared/` (Postmark, email templates) |
| `local/` | Local backend config, seed, candidate migrations, hr-bootstrap |
| `scripts/` | verify, local backend tests, release guards, worktree helper, historical rehearsal ops |
| `tooling/release/` | Pinned wrangler for the upload job only |
| `docs/` | Release process, production baseline; `migration-*.md` are historical |

## Environments (read before running anything)

| Name | Backend | How | Data |
| --- | --- | --- | --- |
| Local | Docker Supabase on 127.0.0.1:55321 | `bun run local:start` then `bun run dev:local` (8080) | Synthetic seed |
| Production | Supabase `acgqjjbrnkmeazswdnzp` + Cloudflare Pages | Manual release workflows only | Real employees |

- **"rehearsal" / "hub-rehearsal" means PRODUCTION.** `dev:rehearsal` and `scripts/rehearsal-*`
  hit the live project with real data; treat them as historical, never run routinely.
- Plain `bun run dev` reads `.env` and can target production. Use `dev:local`.
- `supabase/config.toml` `project_id` is the old Lovable project, not the target.
  Always name the production project explicitly; never `supabase db push`.
- No staging environment exists.

## Dangerous operations

- `local:reset` wipes the shared local DB (all worktrees use one backend).
- Promoting `local/candidate-migrations/*` into `supabase/migrations/` needs release review +
  explicit owner authorization. `local/hr-bootstrap.sql` is local-only.
- Release workflows deploy to production; owner authorizes each run (GitHub does not enforce it).
- Business triggers/Edge functions can email or SMS real people — test only locally.

## Roles

`app_role` enum: `employee` < `foreman` < `office` < `admin`, stored in `user_roles`
(multi-role possible; primary = highest). Admins can "preview as" a lower role (UI only).

## Known issues (not yet fixed)

- `ProtectedRoute` checks the real `role`, not `effectiveRole`: an admin previewing as employee
  can still open `/hr`, `/admin/*`. Pages mix real vs preview role inconsistently.
- AI (`*.lovable.dev` gateway) and Twilio SMS Edge functions depend on retired Lovable
  services; likely broken in production (unverified). `notify-talk-attendees` hardcodes a
  `lovable.app` URL. `independentLaunch` flag hides most of these features.
- "Today" is computed inconsistently outside the jobs helpers: `SafetyViolationDialog` uses the
  UTC date (`toISOString().slice(0,10)`), `Safety.tsx` and the rest of `Schedule.tsx` (week strip,
  past-day locks, date mins) use the browser's local date, `AccidentReportDialog` uses local time.
  Only the Schedule carry-forward uses `todayInNewYork()` (`lib/jobs.ts`).
- Realtime and Edge runtime are disabled locally — subscriptions and functions untested locally.
- 2 high-severity SheetJS (xlsx) advisories; 30 lint warnings; no proven production backup restore.

## Where to look

| Task | Start at |
| --- | --- |
| Add/change a page or route | `src/App.tsx`, [frontend.md](frontend.md#routes) |
| Role/permission behaviour | `src/hooks/useAuth.tsx`, RLS in [backend.md](backend.md#authorization) |
| New table / RLS / RPC | [backend.md](backend.md#migration-workflow) — write a candidate migration |
| Edge function | `supabase/functions/<name>/`, [backend.md](backend.md#edge-functions) |
| File uploads / buckets | [backend.md](backend.md#storage), `src/lib/resumableUpload.ts` |
| Email | `supabase/functions/_shared/`, `process-email-queue`, [backend.md](backend.md#edge-functions) |
| Tests / verification | CLAUDE.md fast-path table, [release.md](release.md#verification) |
| Release / deploy question | [release.md](release.md), `docs/release-process.md` |
| Current status / open gaps | `DEVELOPMENT_PROGRESS.md` |
