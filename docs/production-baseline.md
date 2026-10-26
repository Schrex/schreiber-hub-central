# Production baseline

October 22, 2026 is the starting baseline for production changes going forward.
Use this record and the release runbooks for current operations. Migration documents
and the archived progress log are historical evidence, not instructions to rerun
imports, change providers, or re-enable integrations.

## Verified release

| Item | Baseline |
| --- | --- |
| Live app | https://app.schreiberexcavating.com |
| Source | `8232a077adfcfb70d9535dae714c5679d4355525` (Jobs Active/Archive, release PR #41) |
| Cloudflare Pages project | `schreiber-hub-preview` (production branch `main`) |
| Live deployment | `a4ea3102-ddc7-4084-963f-f1e62474c6df` |
| Production Supabase project | `acgqjjbrnkmeazswdnzp` |
| Exact-main verification | [40378797799](https://github.com/Schrex/schreiber-hub-central/actions/runs/40378797799) |
| Candidate build | [40381792517](https://github.com/Schrex/schreiber-hub-central/actions/runs/40381792517) (artifact expires 2027-01-24) |
| Candidate manifest SHA256 | `279858a4acc702ff0169c9c8d6693b751de057808c741b94a45f360bb1790acc` |
| Verified deployment run | [40382959483](https://github.com/Schrex/schreiber-hub-central/actions/runs/40382959483) |
| Successful production ledger | `7340917252` |
| Previous retained deployment | `6a6e77f0-9371-4e44-a028-6c6ae58ae42c` at `abdde98963d91a4f91e17ac8c176347013304df2` (Add Employee) |
| Recovery evidence for previous | draft release `add-employee-release-abdde98-20261022` (candidate ZIP + checksums) |

Release history (newest first; ledger is authoritative, `gh api repos/Schrex/schreiber-hub-central/deployments`):

| Date | Source | Deployment | Notes |
| --- | --- | --- | --- |
| 2026-10-26 | `8232a07` | `a4ea3102-…` | Jobs Active/Archive; DB migration + `request-truck` v12 first |
| 2026-10-22 | `abdde98` | `6a6e77f0-…` | Add Employee (this table was not updated then) |
| 2026-10-22 | `ac61bb6` | `2c110f18-…` | First guarded release |
| earlier | `ea05047` | `82bbfce8-…` | Pre-release baseline |

The live identity is clean, independent mode, and points to the production backend
above. Homepage and reset-password availability passed. These are deployment
checks, not certification of all employee features or external integrations.

## Backend state

- Migration `20261026010000_jobs_status_lifecycle.sql` applied 2026-10-26 via the Supabase SQL
  editor in one transaction. Before: 7 jobs, 0 complete, columns absent, triggers
  `jobs_seed_contact_slots=O, update_jobs_updated_at=O`. After: columns, both checks and
  `jobs_status_lifecycle=O` present; counts unchanged.
- Edge function `request-truck` v11 → v12 (deployed from `8232a07`, `verify_jwt` true). Its
  non-active rejection has not been exercised in production.

## Recovery evidence to retain

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
