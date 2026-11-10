---
name: local-test-env
description: Start the disposable local test environment (Docker + local Supabase + synthetic demo data + app on port 8080) so a person can click through a feature, or so Claude can click through it and send screenshots. Use when asked to "start the test environment", "spin up the demo", "let me click around", "test this feature locally", or to show a feature working before a PR.
---

# Local test environment

Everything here is the fixed loopback backend (127.0.0.1:55321) with synthetic `@example.test`
data. Never point any step at production, and never use real employee data.

## Start it

1. Check the branch (`git status -sb`). The backend runs the migrations of whichever checkout last
   started it, so start it from the branch being tested.
2. Run `bun run local:demo --seed-only`. This:
   - starts the Docker daemon if it is installed but not running (Claude Code cloud sessions);
     on a laptop it asks the person to open Docker Desktop instead,
   - runs `bun run local:start` if the backend is down (first run pulls images: a few minutes),
   - adds the demo data (safe to rerun): job `Demo Main St Sewer` (DEMO-001) scheduled today in
     New York for a foreman and two crew, plus two toolbox talks, one with a 3-question quiz.
3. Start the app with `bun run dev:local` in the background (port 8080, strict), then call
   `report_preview_port` with 8080 if that tool exists.
4. Give the person the logins (password `LocalOnly-12345!`, email + password sign-in):
   `foreman@example.test` (foreman), `crew1@example.test` and `crew2@example.test` (crew),
   `admin@example.test` (admin), `employee@example.test` / `other@example.test` (base seed).

A person on their own computer can run `bun run local:demo` (without `--seed-only`): it does
steps 2 and 3 in one command and leaves the app running until Ctrl+C.

## Cloud sessions: the person cannot open the page

Claude Code cloud sessions do not support the preview pane and accept no inbound connections, so
the person cannot click the app there. Say so, then offer either:

- a screenshot walkthrough: drive the flow with Playwright (`require('playwright')` works from any
  directory; use `executablePath: '/opt/pw-browsers/chromium'`), `deviceScaleFactor: 2`,
  `timezoneId: 'America/New_York'`, a phone-width viewport, and send each screenshot with
  `SendUserFile`; or
- running the same commands in a session on their own computer (needs Docker Desktop and Bun),
  where the preview pane works.

## Before verification

Demo data does not break `verify:backend` or `verify:browser`, but remove it when a clean
baseline matters: `bun run local:demo --clean`. Do not run `local:reset` or `local:stop` while
another worktree or session is using the shared backend.

## Known blockers the demo exposes

- Starting a toolbox talk as a foreman fails with "infinite recursion detected in policy for
  relation toolbox_talk_sessions". The reviewed fix is the unapplied candidate
  `local/candidate-migrations/20261019220000_attendance_policy_recursion.sql`; applying it
  anywhere needs the release review in CLAUDE.md. Report it rather than working around it.
- Realtime, Edge functions, email and SMS are off locally; flows that depend on them stop there.
