#!/bin/sh
# Inert database baseline only. No files, grants, app triggers or schedules activated.
set -eu
[ "$#" -eq 0 ] || { echo 'No arguments accepted.' >&2; exit 2; }
[ -t 0 ] && [ -t 1 ] || { echo 'Run in your own interactive Terminal.' >&2; exit 2; }
umask 077
cd "$(dirname "$0")/.."
cert='/Users/sumanththota/Downloads/prod-ca-2021.crt'
[ -f "$cert" ] || { echo 'Public CA certificate missing.' >&2; exit 2; }
echo 'Target: hub-rehearsal (acgqjjbrnkmeazswdnzp). Production is never contacted.'
echo 'This imports business records and Auth users/identities. Old sessions/tokens stay archived; everyone must sign in again later.'
echo 'Files, application triggers/grants, queue setup and schedules remain separate. This is not a complete usable restore.'
echo 'Before continuing, verify signup/Email/Data API are OFF; Send Email hook is rehearsal_guard.block_email; no workers are deployed.'
printf 'Type IMPORT ISOLATED REHEARSAL to attest these controls and approve this baseline import: '
IFS= read -r confirmation
[ "$confirmation" = 'IMPORT ISOLATED REHEARSAL' ] || { echo 'Stopped without connecting.'; exit 2; }
root=$(node scripts/migration-runner.mjs)
echo 'Reviewed file hashes verified; private run directory created.'
echo 'Enter the rehearsal database password at the hidden prompt.'
# /dev/tty remains available for psql password prompting; all SQL/error output is private.
if docker run --rm -it --pull=never --read-only --cap-drop=ALL \
 --security-opt=no-new-privileges --tmpfs /tmp \
 --mount "type=bind,source=$cert,target=/tmp/supabase-ca.crt,readonly" \
 --mount "type=bind,source=$root,target=/evidence" \
 --entrypoint sh public.ecr.aws/supabase/postgres:17.11.0.004 -c '
 umask 077
 psql -X -W --set=ON_ERROR_STOP=1 --set=VERBOSITY=terse --single-transaction \
 --dbname="host=aws-0-us-east-2.pooler.supabase.com port=5432 dbname=postgres user=postgres.acgqjjbrnkmeazswdnzp sslmode=verify-full sslrootcert=/tmp/supabase-ca.crt connect_timeout=10 application_name=rehearsal_baseline_import" \
 --file=/evidence/import.sql > /evidence/result.log 2>&1
 '; then
 echo "Baseline committed. Private evidence: $root"
 echo 'Do not enable access yet. Next: independent content reconciliation, then file restoration and reviewed behavior.'
else
 echo "Import failed or connection ended. Private evidence: $root" >&2
 echo 'No automatic retry. Most SQL failures roll back; connection loss at COMMIT needs read-only reconciliation before any retry.' >&2
 exit 1
fi
