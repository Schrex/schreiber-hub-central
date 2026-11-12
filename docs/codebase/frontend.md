# Frontend map

Part of the [codebase map](README.md). Last checked @ `f026a29`.

## Bootstrap

- `src/main.tsx` → `<App/>` (no StrictMode).
- `src/App.tsx` providers, outer → inner: `QueryClientProvider` (unused beyond provider),
  `TooltipProvider`, shadcn `Toaster` + `Sonner`, `BrowserRouter`, `AuthProvider`, `Routes`.

## Routes

Public: `/auth`, `/forgot-password`, `/reset-password` (PasswordRecovery `update`), `/unsubscribe`, `*` NotFound.

Behind `<ProtectedRoute>` (session required, else `/auth?next=<path+query>`; also renders `<BottomNav/>`):

| Path | Page |
| --- | --- |
| `/` | Index (home tiles filtered by `effectiveRole`) |
| `/jobs` (`?view=active` default, `?view=archive`), `/jobs/:id` | Jobs (Active/Archive tabs), JobDetail |
| `/schedule`, `/schedule/whiteboard` | Schedule, Whiteboard |
| `/dispatch` | Dispatch |
| `/safety`, `/safety/take/:token` | Safety, TakeSafetyTalk |
| `/time-off` | TimeOff |
| `/tools`, `/tools/trucking`, `/tools/performance-reviews`, `/tools/handbook` | Tools, TruckingCalculator, PerformanceReviews, Handbook |
| `/apparel`, `/referrals`, `/equipment-rental`, `/shop-booking`, `/perks` | Perks pages |
| `/employee-contacts`, `/vendors`, `/org-chart`, `/my-position` | Directories / people |
| `/hr`, `/admin/users`, `/admin/positions` | **`requireAction="admin.open"`** (hidden while previewing) |

Navigation hubs: `Index.tsx` (`TILES`, includes external HCSS/Clearstory/Divvy links),
`Perks.tsx`, `Tools.tsx`, `HR.tsx`, `components/BottomNav.tsx`. Some pages also render
BottomNav themselves — watch for a double nav.

## Auth and roles

- `src/hooks/useAuth.tsx` → `AuthProvider` / `useAuth()`: `session`, `user`, `role`, `roles`,
  `rolesLoaded`, `effectiveRole`, `previewRole`, `setPreviewRole`, `displayName`, `positionTitle`,
  `loading`, `signOut`. `loading` = `!rolesLoaded`: stays true until the session is known and its
  `user_roles` query settles; `displayName`/`positionTitle` fill in afterwards and do not gate
  readiness. A failed roles query (thrown or returned `error`) ends ready with no roles (deny by
  default) and is retried on the next auth event or app resume (focus/online/visibility).
- `loadProfile` reads `user_roles` (`roles` = all held, highest first; `role` = primary, highest of
  admin > office > foreman > employee), `profiles.display_name`, `employee_positions` →
  `positions_public(title)` current as of `todayInNewYork()`.
- Admin preview-as-role: `components/home/RoleSwitcher.tsx`, sessionStorage `previewRole`.
- Access module (UI gating only; RLS stays the authority): rule data in `lib/accessRules.ts`
  (`ACCESS_RULES`, no imports so `scripts/*.mjs` can load it; each rule = explicit `roles`,
  optional `orJobForeman`, `basis: "real"`, `rls` table/cmd list or `"ui-only"`, `narrower`
  reason), pure decision in `lib/accessDecision.ts` (`decide`, `previewedRoles`; type-only
  imports, shared with `scripts/local-access-policy.mjs` and `useAuth` `effectiveRole`),
  hook/types in `lib/access.ts`: `can(viewer, action, ...job)` and
  `useAccess()` → `{ ready, can }`. Deny by default (not ready / no session / no roles);
  checks the effective role set (preview role while an admin previews, else every role held,
  any-match like `has_role()`); only `preview.switch` uses real roles. Unknown actions and a
  missing job for `orJobForeman` rules fail at compile time. Matrix test `src/test/access.test.ts`.
- All UI gating goes through `can()` / `useAccess()` (#44–#51): `ProtectedRoute requireAction`
  (`admin.open` for `/hr`, `/admin/*`; waits for `ready`, then redirects), Index tiles and role
  switcher, job screens/files, schedule, whiteboard, contacts and the remaining pages.
  New gating = add or reuse an action in `accessRules.ts` (+ row in `access.test.ts`), never an
  inline role comparison.
- Guard: `src/test/noInlineRoleChecks.test.ts` fails on `role === "<role>"`-style comparisons,
  `roles.includes("<role>")` and `switch (role)` outside `lib/access*` and `hooks/useAuth.tsx`
  (preview internals). Exceptions go in its `ALLOWLIST` (file + exact line + reason; stale
  entries fail); currently empty. Classifying *other* users' roles (Whiteboard/Schedule office
  filter over `rolesByUser`, `AdminUsers` rank) is not gating and is not matched.
- `useAuth` fields after the migration: `roles`, `previewRole`, `rolesLoaded`, `user` feed
  `useAccess`; `effectiveRole` (from `previewedRoles`) is for display and the TimeOff notice
  period (`lib/timeOffNotice.ts` `noticeFor`, foreman 28 days, others 14 — business rule, honours
  preview like the rest of the page), plus Index header badge and `RoleSwitcher` value; `role`
  (real primary) gates `setPreviewRole`; `loading` for session waits (Auth, TakeSafetyTalk).
- RLS parity: `bun run test:local:access` (in `verify:backend`, needs the local backend) checks
  every table-linked rule against RLS; see [backend.md](backend.md#backend-tests-bun-run-verifybackend).
- Login (`pages/Auth.tsx`): email/password via Supabase; Google via Supabase OAuth
  (`signInWithOAuth`, not configured in production; disabled locally and under `independentLaunch`).
  After sign-in it goes to `?next` when `lib/safeNextPath.ts` accepts it (same-origin in-app path only;
  absolute, `//`, backslash and `/auth` targets go home). OAuth/signup redirects still return to `/`.

## Data access

- Client: `src/integrations/supabase/client.ts`; env `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`. Auth session stored in `localStorage`.
- Types: `src/integrations/supabase/types.ts` (generated from the local backend, so it includes
  candidate migrations such as the jobs status columns; CLI 2.121.0 + prettier). Production may lag.
- Pattern: `supabase.from(...)` in `useEffect`/handlers + `useState`; errors via sonner `toast`.
  No caching. `hooks/useResumeRefresh.ts` refetches on focus/online/visibility and is the
  fallback for missed realtime; components guard against stale responses.
- RPCs from client: `list_employee_directory`, `get_attendee_by_token`.
- Realtime subscriptions: `truck_requests`, `notifications` (per user), `toolbox_talk_attendees`
  (per session), `whiteboard_tiles` (per week). Untested locally (realtime disabled).
- Storage: private files opened with `createSignedUrl`; large uploads via TUS
  (`lib/resumableUpload.ts`, 6 MB chunks; Photos/Plans use tus directly).
- `lib/talkMedia.ts` rewrites legacy talk-media URLs from the old Lovable project origin — intentional.
- Edge functions invoked: see [backend.md](backend.md#edge-functions). `speak-toolbox-talk` and
  `handle-email-unsubscribe` are called with raw `fetch`.
- External APIs: Open-Meteo (`lib/weather.ts`), Nominatim geocoding, OSRM routing, OSM/ArcGIS tiles.

## Features → files

| Feature | Files | Tables |
| --- | --- | --- |
| Home | `pages/Index.tsx`, `components/home/*` (weather, celebrations, notifications bell) | notifications |
| Jobs | `pages/Jobs.tsx` (Active/Archive tabs synced to `view` URL param, count-only head queries; lists in `components/jobs/ActiveJobsList.tsx`, `ArchiveJobsList.tsx` (server-side search incl. two-step foreman-name match, NY-year filter, pages of 25), reads in `jobsQueries.ts`), `pages/JobDetail.tsx` (`JobStatusSection` = archived/on-hold banners + office/admin "Change status" via `JobStatusSheet`, Undo/Reopen and leaving-active cleanup of future `schedule_assignments` + job `whiteboard_tiles` (status first, then deletes) in `lib/jobStatusChange.ts`; gated by preview-aware role), `lib/jobs.ts` helpers, `components/jobs/*` (JobInfo, Contract, ScopeOfWork, ForemanBrief, JobContacts, Plans, Photos, Permits, Swppp, Submittals, DigTickets, JobFilesSection, JobLookahead, DriveTimeFromShop, RequestTruckButton, SafetyInspectionButton) | jobs + `job_*` children, bid_* |
| Schedule | `pages/Schedule.tsx` (~1.4k lines), `components/schedule/DayBoard.tsx`, `WeekGrid.tsx` (dnd-kit) | schedule_assignments, crews |
| Whiteboard | `pages/Whiteboard.tsx`, `components/whiteboard/*` (foreman+) | whiteboard_tiles, dispatch_orders |
| Dispatch | `pages/Dispatch.tsx`, `components/dispatch/TruckRequestsPanel.tsx` | dispatch_orders, truck_requests |
| Safety | `pages/Safety.tsx` (~1.2k, several subcomponents), `pages/TakeSafetyTalk.tsx`, `components/safety/*` | toolbox_talk*, safety_*, accident_reports |
| Time off | `pages/TimeOff.tsx` | time_off_requests |
| People/HR | `pages/EmployeeContacts.tsx` (~1.2k; AddEmployeeWizard, xlsx/vCard), `AdminUsers`, `AdminPositions`, `MyPosition`, `OrgChart`, `PerformanceReviews`, `HR` | employee_contacts, user_roles, positions, … |
| Perks | `Apparel`, `Referrals`, `EquipmentRental`, `ShopBooking` | clothing_*, referrals, equipment_rentals, shop_reservations |
| Other | `Vendors`, `Handbook`, `TruckingCalculator` (client only), `Unsubscribe` | vendors, handbook_documents |

### Job pickers (status rules, #36)

Status helpers live in `lib/jobs.ts` (`todayInNewYork`, `SAFETY_PICKER_STATUSES`, `isDispatchPickable`).

| Picker | Shows |
| --- | --- |
| Schedule board (`Schedule.tsx`) | active |
| Schedule carry-forward (`Schedule.tsx` `loadAll`) | copies only active-job assignments (`jobs!inner(status)`); "today" = New York |
| Whiteboard | active |
| Dispatch order dialog | active, plus the job an edited order already points at; order rows show the stored `job_name` |
| Accident report / safety violation dialogs | active + on hold (a `presetJob` from the job page bypasses the picker) |
| Toolbox talk job list (`Safety.tsx`) | today's assignments (no status filter) |
| Request truck button / `request-truck` Edge function | active only; function returns 409 otherwise |

Spelling: table/bucket `swpppp_*` / `swpppp-reports` has 3 p's; component is `SwpppSection`.

## Feature flags / env (names only)

- `VITE_LOCAL_BACKEND` — local-test note on Auth, Google off.
- `VITE_INDEPENDENT_LAUNCH` or `VITE_REHEARSAL_BACKEND` → `independentLaunch`
  (`lib/launchScope.ts`): disables signup, Google, celebrations banner, AI/recording/read-aloud/
  notification features in Safety, AI in ScopeOfWork/ForemanBrief/Submittals, contact→user conversion.
- `integrationsParked` (`lib/launchScope.ts`, constant `true`): turns off AI and crew-SMS UI in
  every build because those Edge functions are parked (`parked/README.md`).

## UI conventions

- shadcn/ui (`components.json`, slate, CSS vars) in `components/ui/`; lucide icons; sonner toasts.
- Tailwind: `font-display` = Oswald, tailwindcss-animate, typography.
- Forms: plain `useState`; zod in 8 forms; react-hook-form only in `ui/form.tsx`.
- Dates: date-fns v3, react-day-picker. Also xlsx, tus-js-client, exifr, react-leaflet, @dnd-kit.
- `@/` → `src/`. Pages default-export; feature components named exports.
- Unused: recharts, `NavLink.tsx`.

## Tests

- Vitest (`vitest.config.ts`): jsdom, setup `src/test/setup.ts`, includes `src/**/*.{test,spec}.{ts,tsx}`.
  Mocks: `@/integrations/supabase/client`, `@/hooks/useAuth`, `sonner`.
- Some tests import `supabase/functions/_shared/*` (postmark, profileEmails, notificationResult).
- Colocated: `components/jobs/jobFiles.test.ts`, `JobFilesSection.test.tsx`, `pages/PasswordRecovery.test.tsx`.
- Playwright (`playwright.config.mjs`): 127.0.0.1:8082 via `dev:local --browser-test`, 1 worker,
  TZ America/New_York. Specs (`e2e/*.spec.mjs`): add-employee, job-files, job-status-pickers, jobs,
  jobs-archive-search, jobs-crew-today, jobs-future-cleanup, private-files, safety-refresh,
  time-off, whiteboard-refresh. Needs local backend running.
