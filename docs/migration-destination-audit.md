# Rehearsal destination audit

**Update 2026-10-19:** the export is now privately captured and inspected. See the
[restore selection plan](migration-restore-plan.md) for current evidence and next
steps. Earlier unavailable-export statements below are historical; restore remains
unperformed and destination compatibility/isolation still require verification.

Read-only authenticated dashboard inspection on 2026-10-19. Destination:
`hub-rehearsal` (`acgqjjbrnkmeazswdnzp`), Schreiber Excavating organization.
No settings changed, SQL executed, functions deployed, or data imported.

## Managed definition comparison completed — 2026-10-19

Private operator schema capture succeeded. All 292 managed Auth/storage pg_dump
object definitions match after removing dump headers/session SET statements. Source
adds 57 application storage policies and one new-user trigger; these remain separate
restore candidates. Owners/ACLs excluded by dump options still require review.
Selected application schema successfully replayed against this managed baseline in
a disposable synthetic database. Hosted privilege compatibility and real-data restore
are unproven. Isolation settings from the read-only refresh below remain unchanged.

## Destination preflight refresh — 2026-10-19

Read-only queries through the authenticated dashboard confirmed the target project
`acgqjjbrnkmeazswdnzp`: zero Auth users, public tables, buckets and storage objects;
database size 10,884,787 bytes. No import or settings changes. Private catalog and
comparison reports are saved alongside archive inspection evidence.

All 344 Auth/storage columns match source types and generated-column classification;
no source COPY column is missing. Six columns absent from COPY lists are generated
columns in both schemas. This is column-level compatibility only: enum values,
constraints/defaults, ownership/grants, triggers and managed migration versions are
not certified equivalent. Keep explicit column lists; never replay source-managed
DDL or migration records blindly.

Enabled extensions: plpgsql 1.0, pg_stat_statements 1.11, uuid-ossp 1.1, pgcrypto 1.3,
supabase_vault 0.3.1. pg_cron, pg_net and pgmq are not installed. Their controlled
installation/compatibility remains part of the eventual inert restore preparation.

Current isolation observations: no Edge Functions or Auth hooks; custom SMTP off;
public signup on; anonymous signup off; Email on; other listed identity providers
off. Database SSL enforcement off and network access unrestricted. No controls were
changed. Custom SMTP off does not disable default Auth email. Network restrictions
alone do not isolate Data API/Auth/Storage access, and future imports can introduce
executable triggers. Recheck organization readers and external consumers before load.

Next: specify destination-only signup/client/mail isolation, finish managed constraint
and executable-object review, then build/test exact restore artifacts. Do not import
real data until those controls are established. Passwords/secrets were not read.

## Observed state

| Area | Dashboard evidence |
| --- | --- |
| Project | Free plan, healthy Nano compute, Ohio/us-east-2 |
| Access | Organization-wide access; one organization member with Owner role |
| Versions | PostgreSQL 17.11.0.003; Auth 2.197.0; PostgREST 14.18 |
| Database | Public schema has no tables; earlier views show no migrations/backups |
| Storage/functions | Earlier baseline shows no buckets or deployed Edge Functions |
| Auth users | Empty list, but inconsistent estimated footer; exact count unverified |
| Auth settings | Signup enabled, Email enabled, anonymous disabled, confirmation enabled, Google disabled |
| Auth hooks | Empty state: Create an auth hook |
| Mail | Custom SMTP switch off; default templates. This does not establish that default Auth email delivery is disabled |
| URLs | Site URL `http://localhost:3000`; no additional redirect URLs |
| Enabled extensions | uuid-ossp 1.1, pgcrypto 1.3, plpgsql 1.0, pg_stat_statements 1.11 |
| Available but disabled | pg_net 0.20.4, pg_cron 1.6.4, pgmq 1.5.1 |
| Cron | Install integration state; not installed/enabled |
| Other integrations | Data API and Vault listed installed; Vault version not inspected |

Evidence surfaces: [project settings](https://supabase.com/dashboard/project/acgqjjbrnkmeazswdnzp/settings/general),
[Auth hooks](https://supabase.com/dashboard/project/acgqjjbrnkmeazswdnzp/auth/hooks),
[SMTP](https://supabase.com/dashboard/project/acgqjjbrnkmeazswdnzp/auth/smtp),
[URL configuration](https://supabase.com/dashboard/project/acgqjjbrnkmeazswdnzp/auth/url-configuration),
[schema](https://supabase.com/dashboard/project/acgqjjbrnkmeazswdnzp/database/schemas),
[extensions](https://supabase.com/dashboard/project/acgqjjbrnkmeazswdnzp/database/extensions),
[Cron](https://supabase.com/dashboard/project/acgqjjbrnkmeazswdnzp/integrations/cron).

## Remaining gates

The destination is not ready for real-data import. Secure database connection and
exact catalog/counts remain unverified. Source pg_net was recorded as 0.20.0;
destination availability is 0.20.4, requiring compatibility review. Extension
availability does not mean source queues/functions can already restore.

Per the user's decision, signup remains enabled while empty/synthetic. Disable it
before loading real data. Keep synthetic staging separate. Establish effective
mail/outbound isolation, prevent copied queue triggers from re-arming schedules,
and review independent credentials and actual archive capacity before import.
Never activate copied source Vault credentials. Empty cron state alone is not
proof of side-effect isolation.

Database download/import remains paused because the download link is unavailable.
Use the [acceptance plan](migration-acceptance-checks.md),
[offline inspection tooling](migration-restore-tooling.md), and
[integration map](migration-integration-map.md) when preparation resumes.
No independent restore or production parity has been demonstrated.
