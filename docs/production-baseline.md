# Production baseline

October 22, 2026 is the starting baseline for production changes going forward.
Use this record and the release runbooks for current operations. Migration documents
and the archived progress log are historical evidence, not instructions to rerun
imports, change providers, or re-enable integrations.

## Verified release

| Item | Baseline |
| --- | --- |
| Live app | https://app.schreiberexcavating.com |
| Source | `ac61bb695304d2cb319f5c3605d43f446ed99bca` |
| Cloudflare Pages project | `schreiber-hub-preview` (production branch `main`) |
| Live deployment | `2c110f18-7411-4f63-9d09-3cc291a54470` |
| Production Supabase project | `acgqjjbrnkmeazswdnzp` |
| Candidate build | [39846243630](https://github.com/Schrex/schreiber-hub-central/actions/runs/39846243630) |
| Candidate manifest SHA256 | `b54e868d656e45d8eaeac7d7c80236bf5bf5a8505ae625fec360b15ba4267317` |
| Verified deployment run | [39846752862](https://github.com/Schrex/schreiber-hub-central/actions/runs/39846752862) |
| Successful production ledger | `7262555368` |
| Previous retained deployment | `82bbfce8-7a2f-412f-b3b4-62af659022ef` at `ea0504798c9985ea44ad32d674579b15ae6f0c66` |
| Recovery preflight | [39847008622](https://github.com/Schrex/schreiber-hub-central/actions/runs/39847008622) — passed, no rollback executed |

The live identity is clean, independent mode, and points to the production backend
above. Homepage and reset-password availability passed. These are deployment
checks, not certification of all employee features or external integrations.

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
