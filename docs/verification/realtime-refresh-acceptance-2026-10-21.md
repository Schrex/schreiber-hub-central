# Realtime and refresh acceptance — 2026-10-21

Scope: migration destination `acgqjjbrnkmeazswdnzp` (schreiber-hub), catalog-only
hosted audit, plus synthetic local frontend verification. No hosted publication,
RLS, grants, business records, email, DNS, or production deployment changed.

## Hosted catalog results

Pinned CLI 2.121.0 `db query --linked --project-ref acgqjjbrnkmeazswdnzp`
read only pg_publication, pg_publication_tables, pg_class, pg_policies and column
privileges. `supabase_realtime` exists, not FOR ALL TABLES, and has **zero tables**.
All four subscribed tables have RLS enabled. Anonymous has no table SELECT on them.

| Subscription | Hosted SELECT boundary | Existing / added refresh alternative |
| --- | --- | --- |
| notifications, filtered to current user | Own user_id only; authenticated table SELECT; replica identity FULL | Mount, bell opening, successful mark-read, focus/visible return/online |
| truck_requests, all changes | All authenticated users can read; existing policy, not a newly introduced restriction or grant | Mount, local actions, focus/visible return/online |
| whiteboard_tiles, selected week | Foreman, office, admin; authenticated table SELECT | Added explicit Refresh and focus/visible return/online; local edits retain optimistic behavior |
| toolbox_talk_attendees, session filter | Own attendee row or foreman/office/admin/session foreman under existing policies; column-only SELECT | Existing 15-second polling plus added focus/visible return/online |

Attendees have 18 readable columns, explicitly excluding `access_token`.
The existing Safety loader selected `*`, which is incompatible with this column
grant. It now selects only the nine fields its view uses. No grant was broadened.
Failure now retains the last successful attendee list and displays a stale-data
warning instead of silently showing an empty crew. Overlapping/obsolete loads are
ignored. Polling remains; a successful read clears the warning.

## Whiteboard behavior

Manual Refresh and return/reconnect reconcile missed external changes. A failed
read preserves the last successful board and visibly warns that it may be stale.
All five result sets must succeed before the board is replaced. Request generations
and current-week checks prevent earlier loads overwriting newer state. A week
switch clears old tiles/dispatches rather than displaying the wrong week's data
under the new header. Optimistic mutations invalidate in-flight reads and suppress
refresh until their writes finish; week navigation and copy-forward are disabled
while saving. Dragging/copy dialogs also suppress background replacement. Copy
completion explicitly refreshes with the existing callback ordering preserved.

This is user-triggered reconciliation, **not continuous live delivery**. An event
inside the existing 2.5-second optimistic Realtime suppression window can still be
missed until Refresh, return/reconnect, or navigation. The release must communicate
this mode or complete live Realtime acceptance before claiming immediate updates.

## Executed checks

- `bun run test:browser e2e/whiteboard-refresh.spec.mjs e2e/safety-refresh.spec.mjs`:
  **2 passed**. Whiteboard uses two independently authenticated local admin browser
  sessions and a uniquely labeled real local database task, waits for persisted
  writes, reconciles insertion on explicit focus, retains the task on synthetic
  HTTP403, reconciles deletion on Refresh, and denies employee UI entry. Cleanup
  removes only its own task in finally. This UI denial is not an API RLS test.
- Safety browser check uses **mocked synthetic HTTP response data** with real local
  login. It rejects wildcard/token column selection, renders a signed attendee,
  preserves it after HTTP403, and clears the error after successful resume. No
  safety session or attendance row is written. This does not prove hosted RLS.
- Browser requests restricted to loopback frontend8082 and local API55321. Realtime
  disabled locally. Explicit focus/online events prove handlers, not native mobile
  lifecycle, WebSocket delivery or hosted permission parity.
- `bun run verify:app`: typecheck, **145 unit tests**, build pass. Existing bundle
  size/Browserslist warnings remain.
- `bun run verify:lint`: **0 errors, 30 warnings** (existing lint debt).
- Screenshots visually inspected: `/private/tmp/schreiber-whiteboard-refresh-retains-data.png`
  and `/private/tmp/schreiber-safety-refresh-proof.png`.

Initial test attempts exposed test synchronization mistakes (optimistic UI before
POST completion, then HTTP503 client retries exceeding assertion timeout). Final
test waits persisted POST/DELETE and uses non-retried403 for deterministic failure.

## Recommendation and next gate

Keep hosted publication unchanged while testing the restricted preview. Do not
blanket-publish tables or broaden attendee column grants to make select-star work.
No SQL enablement candidate was prepared because live delivery is not yet accepted
and the frontend now has explicit reconciliation paths.

Before marking this step complete:
1. Exercise the new frontend against destination with approved role sessions:
   permitted Whiteboard users, employee denial, notification ownership, existing
   truck visibility, and attendee safe-column read/participant boundaries.
2. Accept user-triggered Whiteboard/notification/truck reconciliation and 15-second
   attendee polling for launch, or separately review a table/column-scoped Realtime
   configuration. Time off and photos already use resume refresh; they have no
   Realtime subscriber to enable.
3. If immediate updates are required, test authenticated event delivery and denial
   with isolated authorized fixtures, including INSERT/UPDATE/DELETE and reconnect,
   before changing publication. Filters alone are not evidence of authorization.
   Safety's protected access-token column must remain unreadable.
4. Run two-device hosted workflows after frontend preview deployment. Existing
   subscribers do not subscribe to every Whiteboard input (jobs/profiles/dispatch),
   so enabling whiteboard_tiles alone does not make the complete board live.
