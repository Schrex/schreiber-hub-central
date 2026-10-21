# Rehearsal connection readiness — 2026-10-19

Dashboard access to `hub-rehearsal` (`acgqjjbrnkmeazswdnzp`) was rechecked.
During initial inspection no password was collected or database query sent.
The operator subsequently completed the read-only login check below; no remote
setting changed.
The user confirms the database password is saved privately.

## Verified connection details

| Method | Host | Port | User | Database |
| --- | --- | --- | --- | --- |
| Direct | db.acgqjjbrnkmeazswdnzp.supabase.co | 5432 | postgres | postgres |
| Session pooler | aws-0-us-east-2.pooler.supabase.com | 5432 | postgres.acgqjjbrnkmeazswdnzp | postgres |

The dashboard labels session pooling as free IPv4 proxying. No paid IPv4 add-on
is needed for this route. Direct hostname resolution failed on this host.
The session endpoint was reachable, but system CA validation initially failed.
Downloaded the public Supabase CA via Database Settings to
`/Users/sumanththota/Downloads/prod-ca-2021.crt`.
OpenSSL then verified the chain and hostname successfully using TLS 1.3.
No credentials or PostgreSQL startup/authentication packet were sent.

Python 3.14 strict certificate verification also rejected the vendor CA because
it lacks a key-usage extension. No Python verification flags were relaxed.
OpenSSL's standard CA/hostname verification succeeded; use a verified PostgreSQL
client with `sslmode=verify-full` and explicit `sslrootcert` for the next step.
See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres)
and [psql guidance](https://supabase.com/docs/guides/database/psql).

## Authenticated check — operator result confirmed

Prepared `scripts/rehearsal-login-check.sh` for the operator to run in their own
terminal. It reuses the installed Supabase PostgreSQL 17.11 client image with
`--pull=never`, launches only psql, mounts the public CA read-only, fixes the
destination host/user, requires hostname/CA verification, disables startup files,
and requests the password through psql's hidden terminal prompt. It runs one
read-only version/identity query with timeouts and ROLLBACK. No password storage,
imports, arbitrary arguments or environment-supplied target are supported.

```sh
sh /Users/sumanththota/Schrex/code/schreiber-hub-central/scripts/rehearsal-login-check.sh
```

Validated shell syntax, rejection of noninteractive execution and the container
client/certificate mount (`psql 17.11`). User-supplied terminal screenshot on
2026-10-19 shows BEGIN, SET, SET, one row with database `postgres`, role `postgres`,
version `17.11`, `read_only=on`, then ROLLBACK and return to the shell without
visible errors. This confirms the operator's read-only login/query result in the
context of the provided fixed-target helper; the screenshot alone does not show
the hostname. No password was disclosed or screenshot committed. The
container is disposable and removed on exit; the existing local database is not
used for this hosted query or modified. Do not paste the password into chat.

A host `psql` executable was not found in PATH or the checked Homebrew libpq/PG17
locations; the helper now supplies the existing container client instead.
Enter the password only into a local hidden prompt or protected passfile;
never put it in chat, Git, shell arguments or a connection URL in history.
Use the exact session host, port and project-specific username above, an explicit
CA file, startup files disabled (`-X`) and fail-on-error behavior.

The completed first query was a read-only transaction with timeouts returning
database version/current database/current user and the read-only setting.
Do not import, execute application routines or change extensions as a connection
test. Project identity rests on the dashboard-verified host/user mapping plus TLS;
the database name `postgres` alone is not identity proof. Full privilege/catalog
checks and actual restore compatibility remain unverified.

Database Settings currently reports access from all IP addresses. No network
restrictions or SSL enforcement settings were changed. Destination isolation remains
a pre-import gate. Database download and all real-data import remain paused.
