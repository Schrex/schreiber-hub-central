#!/bin/sh
# Manual, password-prompted read-only check of the named rehearsal project only.
set -eu
if [ "$#" -ne 0 ]; then
  echo 'No arguments accepted. Never pass a password to this script.' >&2
  exit 2
fi
if [ ! -t 0 ] || [ ! -t 1 ]; then
  echo 'Run in your own interactive terminal; enter the password only at the hidden prompt.' >&2
  exit 2
fi
cert='/Users/sumanththota/Downloads/prod-ca-2021.crt'
if [ ! -f "$cert" ]; then
  echo 'Download the public CA certificate from the rehearsal Database Settings first.' >&2
  exit 2
fi
echo 'Read-only login check: hub-rehearsal (acgqjjbrnkmeazswdnzp).'
echo 'Enter its database password at the hidden prompt. Nothing is imported or saved.'
# Reuse the already-installed PostgreSQL image. No image pull or server starts.
# Password is read by psql from the terminal, never an environment variable/argument.
exec docker run --rm -it --pull=never --read-only --cap-drop=ALL \
  --security-opt=no-new-privileges --tmpfs /tmp \
  --mount "type=bind,source=$cert,target=/tmp/supabase-ca.crt,readonly" \
  --entrypoint psql public.ecr.aws/supabase/postgres:17.11.0.004 \
  -X -W -v ON_ERROR_STOP=1 \
  'host=aws-0-us-east-2.pooler.supabase.com port=5432 dbname=postgres user=postgres.acgqjjbrnkmeazswdnzp sslmode=verify-full sslrootcert=/tmp/supabase-ca.crt connect_timeout=10 application_name=rehearsal_readonly_check options=-cdefault_transaction_read_only=on' \
  -c "BEGIN READ ONLY; SET LOCAL statement_timeout = '10s'; SET LOCAL lock_timeout = '3s'; SELECT current_database() AS database, current_user AS role, current_setting('server_version') AS version, current_setting('transaction_read_only') AS read_only; ROLLBACK;"
