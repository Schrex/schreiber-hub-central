# Independent preview build receipt — 2026-10-21

Prepared locally; not uploaded, integrated or production-approved.

- Source: clean `367ba33ace9c7b76f96fcf51811154af904abc1a` on codex/export-capture.
- Destination: schreiber-hub, `acgqjjbrnkmeazswdnzp`.
- Mode: independent; signup/Google/deferred launch controls disabled.
- Toolchain: Node26.8.2, Bun1.3.14, pinned CLI2.121.0.
- Build directory: `dist/independent`.
- Upload archive: `dist/schreiber-hub-preview-367ba33.zip` (1,902,291 bytes).
- Archive SHA256: `da2812c7633b9a64048f6429832fbd1df57b7bba130ee6f062017cb35880dba4`.
- Per-file manifest: `dist/independent-367ba33-manifest.json`, covering12 files.

Builder bypasses .env and Vite source config/plugins and strips inherited environment
variables. The destination legacy anon client key was retrieved with the authorized
CLI and passed in process memory; no server key was supplied to Vite or logged.
Build-info records dirty=false, exact revision and destination. Static artifact scan
found one JWT, with destination anon claims; no privileged JWT, sb_secret token,
private-key marker, database URL, source map, SQL or source/config file was found.
This is bounded static evidence, not a general secret-leak guarantee.

The old Supabase hostname remains solely in known safety-media URL classification,
which rewrites recognized stored references to destination signing. Lovable hostname
strings remain in generated preview-auth code (inactive off its host zones); Google
login is disabled in independent mode. Google Fonts and the existing external social
preview image remain external assets. No claim that every external URL was removed.

Verification: all12 verify tasks pass, including typecheck,145 unit tests, build,
six backend tasks, lint(0 errors/30 existing warnings), Edge static checks and4 browser
workflows. Independent builder's2 environment/key guard tests pass. Packaged artifact
served only at loopback8084: sign-in renders with Google disabled/signup absent,
recovery route renders. No login or reset email submitted. Screenshot:
/private/tmp/schreiber-release-signin-367ba33.png. SPA rewrite and headers included;
actual Cloudflare deep-link/cache/access behavior remains untested.

Integration status: draft PR10 targets develop but its head is4d23c41, seven commits
behind this build source. No remote checks/review approval reported. Local review of
latest changes and all verification do not constitute independent PR approval. No
push/merge occurred. Reconcile the draft PR with the current codex branch before
calling this an integrated release; main is untouched.

Use this as a restricted-preview candidate only after access protection is configured.
Before upload, verify the archive hash and build-info revision. Ordinary Vite builds
can replace dist; preserve this identified archive before rebuilding. Hosted role/file
acceptance and refresh-mode approval remain pending; automatic email stays off.
