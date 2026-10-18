# Lint backlog — 2026-10-16

Initial baseline: **127 errors and 30 warnings**. After synchronizing the feature
branch with origin/main at 5a81add: **128 errors and 30 warnings**; the incoming
previewAuthStorage.ts adds one prefer-const error. The table below retains the initial snapshot. Lint remains a failing verification
job; no rule was disabled and no continue-on-error was added to CI.

Latest cleanup: **53 errors and 30 warnings** remain (75 errors removed).
Current errors: 49 explicit-any, two regex escapes, one generated preview-auth
prefer-const, and one empty audio retry catch. Frontend error handling, inferred
query types, several typed writes, props aliases, schedule declarations, and
Tailwind import have been cleaned up. Eight error-message regression tests added;
full local verification passes all seven non-lint checks. No rules were disabled.
Generated files and backend function code remain unchanged in this batch.

The category and file tables below are historical, not the current remaining count.

| Category | Count | Approach |
| --- | --- | --- |
| Explicit any | 116 errors | Replace with generated DB types, narrowed unknown values, and actual UI/domain interfaces; avoid casts that merely hide problems |
| Empty object types | 2 errors | Determine intended props/type semantics |
| prefer-const | 5 errors | Small mechanical cleanup |
| Useless escapes | 2 errors | Check intended regex/string behavior before changing |
| Empty block | 1 error | Define appropriate error handling; do not silently discard failures |
| require-style import | 1 error | Check build-tool compatibility before converting |
| Hook dependency warnings | 13 | Review effect semantics, stale values and repeated requests |
| React refresh warnings | 16 | Review module boundaries separately from functional defects |
| Other warning | 1 | Inspect original ESLint output |

Fix small mechanical groups first, then typed boundaries and hook behavior in scoped
changes. Re-run checks for each changed behavior. Do not reset or raise a baseline to
make a failing build appear successful. Unit tests now cover error-message handling in addition to the original placeholder;
this is still not meaningful UI workflow coverage.

## Files at this snapshot

| File | Errors | Warnings |
| --- | --- | --- |
| `src/pages/Safety.tsx` | 21 | 2 |
| `supabase/functions/complete-safety-talk/index.ts` | 8 | 0 |
| `src/pages/TimeOff.tsx` | 7 | 0 |
| `src/components/jobs/SubmittalsSection.tsx` | 6 | 1 |
| `src/pages/Schedule.tsx` | 6 | 0 |
| `supabase/functions/notify-talk-attendees/index.ts` | 5 | 0 |
| `supabase/functions/inbound-swpppp-email/index.ts` | 5 | 0 |
| `src/pages/TakeSafetyTalk.tsx` | 5 | 0 |
| `src/components/jobs/SwpppSection.tsx` | 4 | 1 |
| `src/components/jobs/ScopeOfWorkSection.tsx` | 4 | 1 |
| `src/pages/EmployeeContacts.tsx` | 4 | 0 |
| `src/pages/AdminPositions.tsx` | 4 | 0 |
| `supabase/functions/suggest-safety-topic/index.ts` | 3 | 0 |
| `src/components/jobs/ForemanBriefSection.tsx` | 2 | 2 |
| `src/hooks/useWeather.ts` | 2 | 1 |
| `src/components/jobs/ContractSection.tsx` | 2 | 1 |
| `supabase/functions/submit-safety-violation/index.ts` | 2 | 0 |
| `supabase/functions/submit-accident-report/index.ts` | 2 | 0 |
| `supabase/functions/request-truck/index.ts` | 2 | 0 |
| `supabase/functions/request-safety-inspection/index.ts` | 2 | 0 |
| `supabase/functions/extract-scope-from-contract/index.ts` | 2 | 0 |
| `supabase/functions/extract-foreman-brief/index.ts` | 2 | 0 |
| `supabase/functions/decide-truck-request/index.ts` | 2 | 0 |
| `supabase/functions/_shared/transactional-email-templates/registry.ts` | 2 | 0 |
| `src/components/jobs/EstimateUploads.tsx` | 2 | 0 |
| `src/components/dispatch/TruckRequestsPanel.tsx` | 2 | 0 |
| `src/components/jobs/JobContactsSection.tsx` | 1 | 1 |
| `tailwind.config.ts` | 1 | 0 |
| `supabase/functions/transcribe-toolbox-talk/index.ts` | 1 | 0 |
| `supabase/functions/speak-toolbox-talk/index.ts` | 1 | 0 |
| `supabase/functions/send-transactional-email/index.ts` | 1 | 0 |
| `supabase/functions/generate-toolbox-talk/index.ts` | 1 | 0 |
| `src/pages/Referrals.tsx` | 1 | 0 |
| `src/pages/Jobs.tsx` | 1 | 0 |
| `src/pages/Auth.tsx` | 1 | 0 |
| `src/lib/currentPositions.ts` | 1 | 0 |
| `src/components/whiteboard/CopyForwardDialog.tsx` | 1 | 0 |
| `src/components/ui/textarea.tsx` | 1 | 0 |
| `src/components/ui/command.tsx` | 1 | 0 |
| `src/components/safety/SafetyViolationDialog.tsx` | 1 | 0 |
| `src/components/safety/AccidentReportDialog.tsx` | 1 | 0 |
| `src/components/jobs/SafetyInspectionButton.tsx` | 1 | 0 |
| `src/components/jobs/RequestTruckButton.tsx` | 1 | 0 |
| `src/components/jobs/PermitsSection.tsx` | 1 | 0 |
| `src/components/jobs/DigTicketsSection.tsx` | 1 | 0 |
| `src/pages/Dispatch.tsx` | 0 | 2 |
| `supabase/functions/_shared/transactional-email-templates/truck-request-submitted.tsx` | 0 | 1 |
| `supabase/functions/_shared/transactional-email-templates/truck-request-decision.tsx` | 0 | 1 |
| `supabase/functions/_shared/transactional-email-templates/time-off-approved.tsx` | 0 | 1 |
| `supabase/functions/_shared/transactional-email-templates/safety-violation.tsx` | 0 | 1 |
| `supabase/functions/_shared/transactional-email-templates/safety-talk-summary.tsx` | 0 | 1 |
| `supabase/functions/_shared/transactional-email-templates/safety-inspection-request.tsx` | 0 | 1 |
| `supabase/functions/_shared/transactional-email-templates/new-hire-document.tsx` | 0 | 1 |
| `supabase/functions/_shared/transactional-email-templates/accident-report.tsx` | 0 | 1 |
| `src/pages/PerformanceReviews.tsx` | 0 | 1 |
| `src/pages/JobDetail.tsx` | 0 | 1 |
| `src/hooks/useAuth.tsx` | 0 | 1 |
| `src/components/ui/toggle.tsx` | 0 | 1 |
| `src/components/ui/sonner.tsx` | 0 | 1 |
| `src/components/ui/sidebar.tsx` | 0 | 1 |
| `src/components/ui/navigation-menu.tsx` | 0 | 1 |
| `src/components/ui/form.tsx` | 0 | 1 |
| `src/components/ui/button.tsx` | 0 | 1 |
| `src/components/ui/badge.tsx` | 0 | 1 |
