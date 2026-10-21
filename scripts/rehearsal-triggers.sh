#!/bin/sh
# Install only pinned public triggers, all disabled, in isolated rehearsal.
set -eu
[ "$#" -eq 0 ] || { echo 'No arguments accepted.' >&2; exit 2; }
[ -t 0 ] && [ -t 1 ] || { echo 'Run in your own interactive Terminal.' >&2; exit 2; }
umask 077
cd "$(dirname "$0")/.."
cert='/Users/sumanththota/Downloads/prod-ca-2021.crt'
[ -f "$cert" ] || { echo 'Public CA certificate missing.' >&2; exit 2; }
echo 'Target: hub-rehearsal (acgqjjbrnkmeazswdnzp). Production is never contacted.'
echo 'Installs 70 business triggers DISABLED. No rows, grants, Auth triggers, workers or schedules are changed.'
echo 'Verify signup/Email/Data API remain OFF, email blocker remains enabled, and no workers are deployed.'
printf 'Type INSTALL DISABLED TRIGGERS: '
IFS= read -r confirmation
[ "$confirmation" = 'INSTALL DISABLED TRIGGERS' ] || { echo 'Stopped without connecting.'; exit 2; }
root=$(python3 scripts/rehearsal-trigger-runner.py)
echo 'Reviewed file hashes verified; private run directory created.'
echo 'Enter the rehearsal database password at the hidden prompt.'
# Match the proven login helper: psql is the direct container entrypoint.
# SQL output stays private; SQLSTATE-only errors omit row values and error context.
# Precreate the output file with owner-only permissions before Docker opens it.
: > "$root/result.log"
if docker run --rm -it --pull=never --read-only --cap-drop=ALL \
 --security-opt=no-new-privileges --tmpfs /tmp \
 --mount "type=bind,source=$cert,target=/tmp/supabase-ca.crt,readonly" \
 --mount "type=bind,source=$root,target=/evidence" \
 --entrypoint psql public.ecr.aws/supabase/postgres:17.11.0.004 \
 -X -W --quiet --set=ON_ERROR_STOP=1 --set=VERBOSITY=sqlstate --single-transaction \
 'host=aws-0-us-east-2.pooler.supabase.com port=5432 dbname=postgres user=postgres.acgqjjbrnkmeazswdnzp sslmode=verify-full sslrootcert=/tmp/supabase-ca.crt connect_timeout=10 application_name=rehearsal_disabled_triggers' \
 --output=/evidence/result.log --file=/evidence/install.sql; then
 echo "Disabled triggers committed. Private evidence: $root"
 echo 'Keep access disabled. Next: independently verify 70 disabled triggers; do not rerun this installer.'
else
 echo "Trigger installation failed or connection ended. Private evidence: $root" >&2
 echo 'No automatic retry. Most SQL failures roll back; connection loss at COMMIT needs read-only reconciliation before any retry.' >&2
 exit 1
fi
