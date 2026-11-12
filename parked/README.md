# Parked features

The AI and SMS features below were built on Lovable services (Lovable AI gateway, Lovable's Twilio
connector). Those services are retired, so the features are parked here: the code is kept
for future development but is **not deployed and not reachable from the app**.

- Server code lives in `parked/edge-functions/`, outside `supabase/functions/`, so it is never
  deployed with the other Edge functions and is not part of `typecheck:edge`.
- Their buttons and calls in the app stay in the source but are switched off by
  `integrationsParked` in `src/lib/launchScope.ts`.
- All Lovable connections have been removed from the parked code. AI calls go through a
  provider-neutral adapter (`edge-functions/_shared/ai.ts`); SMS calls Twilio directly.
  Neither has been configured or tested with a real provider.

## What is parked

| Feature | Edge function | Where it appears in the app | What it does |
| --- | --- | --- | --- |
| Toolbox-talk generator | `generate-toolbox-talk` | Safety (admin) | Writes a 2–3 minute talk from a topic: hazards, do-this list, foreman voice script, 3 quiz questions, optional jobsite image |
| Safety-topic suggester | `suggest-safety-topic` | Safety → start a talk | Reads the day's crew schedule for a job and picks a matching library talk or suggests a topic |
| Foreman brief | `extract-foreman-brief` | Job → Foreman Brief | Reads the uploaded contract and writes a short field briefing for the foreman |
| Scope extraction | `extract-scope-from-contract` | Job → Scope of Work | Reads the uploaded contract and turns its scope of work into checklist items |
| Document categorizer | `categorize-document` | Job → Submittals upload | Reads an uploaded file and pre-fills its type and details |
| Crew talk notifications (SMS) | `notify-talk-attendees` | Safety → live talk session | Texts each crew member a link to take the quiz and sign |

## Parked page: the old Schedule (#99)

The hub's own Schedule page (`src/pages/Schedule.tsx`, `components/schedule/DayBoard.tsx`,
`WeekGrid.tsx`) is parked in place, not moved: nobody used it, and "Schedule" now opens the
separate Daily Schedule app at `/daily-schedule/` (the hub forwards that path to its Worker).

- `schedulePageParked` in `src/lib/launchScope.ts` is `true`, so `/schedule`
  (`components/schedule/ScheduleEntry.tsx`) does a real page load to `/daily-schedule/`,
  replacing `/schedule` in history.
- Nothing was deleted: the page code and the `schedule_assignments` table stay. Features that
  read that table (Job Lookahead, Jobs crew-today counts, Safety, Whiteboard, job status cleanup)
  keep working but stay empty while nobody writes it.
- `/schedule/whiteboard` is not parked; it stays a hub page.

To restore it: set `schedulePageParked` to `false`, run the app tests and the browser specs (the
carry-forward check in `e2e/job-status-pickers.spec.mjs` runs again on its own when the switch
is off), then release through the normal process. The old page then opens at `/schedule` again,
for signed-in users, with its data.

Google sign-in is not parked: it now uses Supabase's own Google OAuth and stays disabled
in production until Google is configured in Supabase.

## Restoring a feature

1. Move the function back: `git mv parked/edge-functions/<name> supabase/functions/<name>`.
   For AI features also move `parked/edge-functions/_shared/ai.ts` to
   `supabase/functions/_shared/ai.ts`. Add the function to `scripts/check-edge.mjs`.
2. Configure secrets on the Supabase project (names only; never commit values):
   - AI: `AI_API_URL` (an OpenAI-compatible chat-completions URL), `AI_API_KEY`, `AI_MODEL`,
     optional `AI_IMAGE_MODEL`. Without them the functions answer 503 "AI is not configured".
     Image generation expects the response shape Lovable's gateway used
     (`message.images[0].image_url.url`); check it against the chosen provider.
   - SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, optional
     `APP_BASE_URL` (defaults to https://app.schreiberexcavating.com).
3. Turn the UI back on by replacing the `integrationsParked` checks for that feature
   (production builds also hide these under `independentLaunch`).
4. Test locally with synthetic data, then deploy through the normal release process.
   SMS and AI calls reach real people and paid services; never test them against production.

Production may still have older, Lovable-based copies of these functions deployed. They
cannot work (the Lovable services are gone) and can be deleted from the Supabase dashboard
as a separate, explicitly authorized operation.
