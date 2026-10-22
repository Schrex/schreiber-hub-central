# Release process

## Branch responsibilities

- `main`: approved production source baseline. Changes enter through a reviewed release PR; a merge does not deploy the app.
- `develop`: integrated changes for the next release.
- `codex/*`: feature, fix, or release preparation branches starting from develop.

## Current deployment mechanism

GitHub Actions runs app, backend, lint, Edge static, and browser verification.
It does not deploy. Cloudflare Pages uses direct uploads, with no repository Git
integration in the recorded deployment setup. Supabase database migrations,
Edge Functions, Auth configuration, and email activation are separate operations.
Do not infer that a frontend release updates any of those services.

## Normal change and release cycle

1. Describe the change and acceptance criteria in an issue or PR.
2. Implement on a feature branch from current develop; open a PR into develop.
3. Require all five verification groups to pass and review the change.
4. Merge into develop. Build a clean, pinned commit using the guarded independent
   builder described in migration-hosting-recovery.md. Keep the independent launch
   controls until each deferred feature is explicitly restored and tested.
5. Test a protected preview. Document its backend target: preview hosting does not
   isolate production data. Use synthetic local data for routine tests; do not
   run those tests against the live backend.
6. Prepare a release PR into main. Record the candidate commit, preview results,
   backend/configuration changes (or none), artifact checksum, and recovery plan.
7. Obtain explicit approval for the main merge and production deployment. If the
   merge creates a new commit, build that exact clean commit and verify its artifact
   before upload. Never label a different commit's binary as the new release.
8. Upload the approved frontend artifact to Cloudflare Pages Production. Confirm
   the live /build-info.json revision, destination project and independent mode;
   check sign-in and the changed workflow. Record deployment ID and artifact hash.
9. Tag the verified release and record release notes. Reconcile main back into
   develop through a PR so release-only changes and history remain shared.

A failed release is not repaired by moving Git branches alone. Restore a known
working frontend deployment when appropriate; database/data recovery requires its
own reviewed procedure. Retain the prior artifact and deployment identifier.

## Initial migration reconciliation: prepared, not released

On 2026-10-22 the live build-info endpoint reported:

- Revision: ea0504798c9985ea44ad32d674579b15ae6f0c66
- Dirty: false
- Backend project: acgqjjbrnkmeazswdnzp
- Mode: independent
- Build time: 2026-10-21T13:56:10.684Z

Develop at df2314d differs from that revision only in README.md and
DEVELOPMENT_PROGRESS.md. Main at fca1a73 has two unique commits, 7b80fe9 and its
merge fca1a73, changing only src/integrations/supabase/previewAuthStorage.ts.
Those changes type and refactor the Lovable preview broker. The independent
custom hostname uses localStorage rather than that broker.

The reconciliation branch incorporates main's ancestry and explicitly retains
develop's deployed previewAuthStorage.ts. This preserves the reviewed production
runtime instead of introducing an untested legacy-preview refactor. Both main
commits remain in history for future inspection. No history rewrite is needed.

The intended release contains develop's existing application and documentation
plus this process record. No new runtime changes, database migrations, Edge
Function deployments, public signup, onboarding, or email activation are included.
The primary checkout's uncommitted migration evidence is outside this release and
must remain preserved for a separate reviewed documentation/proof change.

Main merge and live deployment remain pending explicit release approval and
candidate verification. The live app remains the recorded ea05047 artifact until
an actual deployment is independently verified. Branch protection, automatic
preview builds, and an approval-gated deployment workflow are future configuration
work, not capabilities provided by this document.
