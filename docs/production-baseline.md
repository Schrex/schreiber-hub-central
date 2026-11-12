# Production baseline

October 22, 2026 is the starting baseline for production changes going forward.
Use this record and the release runbooks for current operations. Migration documents
and the archived progress log are historical evidence, not instructions to rerun
imports, change providers, or re-enable integrations.

## Verified release

| Item | Baseline |
| --- | --- |
| Live app | https://app.schreiberexcavating.com |
| Source | `6a8c54216a44cd9e4dc901ec32c7baf91f4c99e2` (Daily Schedule forwarding #101, Schedule buttons #102, and #56; release PR #103) |
| Cloudflare Pages project | `schreiber-hub-preview` (production branch `main`) |
| Live deployment | `855a0911-4cf8-4fc8-b5b9-6ac4ad447a6f` |
| Production Supabase project | `acgqjjbrnkmeazswdnzp` |
| Pages Function | `functions/daily-schedule/[[path]].js` only (approved hash in `scripts/release-policy.mjs`); `_routes.json` sends only `/daily-schedule` and `/daily-schedule/*` to it |
| Service binding | `DAILY_SCHEDULE` → Worker `daily-schedule` (environment production), on the Production deployment config only; set 2026-11-12 before the upload |
| Exact-main verification | [43316931788](https://github.com/Schrex/schreiber-hub-central/actions/runs/43316931788) |
| Candidate build | [43317473872](https://github.com/Schrex/schreiber-hub-central/actions/runs/43317473872) (Actions copy expires 2027-02-10; archived below) |
| Candidate manifest SHA256 | `6fdf7881b90bdd6e6ea8ab57171a0129e3ee3b5384f74af7614e01b283f1b8bd` |
| Verified deployment run | [43319217681](https://github.com/Schrex/schreiber-hub-central/actions/runs/43319217681) |
| Successful production ledger | `7751274144` |
| Previous retained deployment | `a4ea3102-ddc7-4084-963f-f1e62474c6df` at `8232a077adfcfb70d9535dae714c5679d4355525` (Jobs Active/Archive) |
| Recovery evidence for previous | draft release `production-candidate-8232a07-20261026` (candidate ZIP, checksums, live receipt) |
| Archive of this release | draft release `production-candidate-6a8c542-20261112`: candidate ZIP (SHA256 `4ab48362abf2e75641e59eb425b91c60764ea572737670991c8bc7632d964619`), SHA256SUMS, live receipt. Use as `recovery_reference` for the next release |

Release history (newest first; ledger is authoritative, `gh api repos/Schrex/schreiber-hub-central/deployments`):

| Date | Source | Deployment | Notes |
| --- | --- | --- | --- |
| 2026-11-12 | `6a8c542` | `855a0911-…` | Daily Schedule at `/daily-schedule/` (first Pages Function + `DAILY_SCHEDULE` binding); also ships #56 (access module, auth readiness, Lovable removal); no backend changes |
| 2026-10-26 | `8232a07` | `a4ea3102-…` | Jobs Active/Archive; DB migration + `request-truck` v12 first |
| 2026-10-22 | `abdde98` | `6a6e77f0-…` | Add Employee (this table was not updated then) |
| 2026-10-22 | `ac61bb6` | `2c110f18-…` | First guarded release |
| earlier | `ea05047` | `82bbfce8-…` | Pre-release baseline |

The live identity is clean, independent mode, and points to the production backend
above. On 2026-11-12: `/`, `/auth`, `/jobs` and `/schedule/whiteboard` answered; `/daily-schedule/`
is served by the Daily Schedule Worker (`/daily-schedule/api/me` answers 401 when signed out);
`/schedule` loads `/daily-schedule/` with a full page load. These are deployment
checks, not certification of all employee features or external integrations.

## Backend state

- Migration `20261026010000_jobs_status_lifecycle.sql` applied 2026-10-26 via the Supabase SQL
  editor in one transaction. Before: 7 jobs, 0 complete, columns absent, triggers
  `jobs_seed_contact_slots=O, update_jobs_updated_at=O`. After: columns, both checks and
  `jobs_status_lifecycle=O` present; counts unchanged.
- Edge function `request-truck` v11 → v12 (deployed from `8232a07`, `verify_jwt` true). Its
  non-active rejection has not been exercised in production.

## Recovery evidence to retain

- Private draft release tag `production-candidate-8232a07-20261026` retains the exact
  `8232a07` candidate ZIP, checksum and live receipt. Archive checks: ZIP digest equals the
  build's logged upload digest; `release.json` matches the approved digest and all 12 file
  hashes; archived files match the live site; round-trip download verified.
- Private draft release tag `production-candidate-ac61bb6-20261022` retains the
  exact candidate ZIP, checksum and live receipt.
- Private draft release tag `recovery-baseline-ea05047-20261022` retains the rebuilt
  prior frontend, checksum and per-file evidence. ZIP SHA256:
  `49ed9bf4c279b520d59751fa24ddc383c89fc01c0b1982c5dea44b623a3a04fd`.
- Resolve drafts by tag with `gh release view <tag> --repo Schrex/schreiber-hub-central`;
  GitHub's temporary draft URLs can change when draft metadata is edited.
- All nine prior publicly served static files matched the reconstruction. Its
  build timestamp is new; header/redirect files are source-derived. The original
  ZIP was not recovered. Native rollback uses the retained Cloudflare deployment.
- Do not delete release archives, ledger history, source exports, applied migrations,
  or paused legacy data as routine cleanup. Frontend archives do not replace a
  database/Auth/Storage backup and tested restore.

## Operating rules

1. Start `codex/*` feature branches from current `origin/develop`.
2. Test against disposable local synthetic data and integrate reviewed PRs into develop.
3. Obtain explicit authorization for each release PR into main and live execution.
4. Verify exact main, build the candidate, run plan/preflight, and upload only the
   approved artifact. Merging or pushing does not deploy.
5. Verify live identity and routes, retain the receipt, and update this record.
   Stop and inspect uncertain outcomes; do not retry uploads or roll back blindly.

See [release process](release-process.md) and [manual operations](manual-frontend-operations.md).
Main can remain at the deployed source while develop receives documentation or
future feature work. Do not merge documentation into main just to make SHA values equal.
The execution switch is enabled; manual dispatch and exact confirmation still apply.
GitHub owner-only review enforcement is not configured. Pages/Access credentials
expire January 20, 2027 and require renewal before that date.

## Retirement and remaining work

Lovable hosting/domain/sync were retired earlier. On October 22, a refreshed
provider page confirmed the old Cloud project paused and database inactive.
Lovable GitHub App installation `171765215` now selects only the unrelated
`hcss-readonly-mcp-server`; it no longer has access to this private repository.
Other projects, paused data, and billing were preserved. Billing cancellation was
previously deferred by the owner.

Remaining items are tracked in [development progress](../DEVELOPMENT_PROGRESS.md):
full backend backup/restore proof,
the two open SheetJS advisories, and deferred integration/feature acceptance.
Deepgram/ElevenLabs features are out of scope by owner instruction. Their saved
API secrets were removed from the paused old Lovable project and absence verified.
Provider-side key revocation was not performed. Add Employee remains disabled until
its separate onboarding work passes review.
