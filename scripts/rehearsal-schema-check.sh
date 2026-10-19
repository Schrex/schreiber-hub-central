#!/bin/sh
# Destination-only schema capture; no rows or database writes.
set -eu
[ "$#" -eq 0 ] || { echo 'No arguments accepted.' >&2; exit 2; }
[ -t 0 ] && [ -t 1 ] || { echo 'Run in your own interactive Terminal.' >&2; exit 2; }
umask 077
cert='/Users/sumanththota/Downloads/prod-ca-2021.crt'
root='/Users/sumanththota/Schrex/archive/database-2026-10-19/inspection'
[ -f "$cert" ] && [ -d "$root" ] || { echo 'Private archive or public CA certificate missing.' >&2; exit 2; }
[ ! -L "$root" ] || { echo 'Refusing symlink output directory.' >&2; exit 2; }
out="$root/destination-schema-$(date -u +%Y%m%dT%H%M%SZ).sql"
[ ! -e "$out" ] || { echo 'Output already exists.' >&2; exit 2; }
echo 'Read-only schema capture from hub-rehearsal (acgqjjbrnkmeazswdnzp).'
echo 'Enter its database password at the hidden prompt. No data rows are exported.'
# pg_dump writes to a private host mount so terminal output never contains SQL.
# This uses the already installed client image, not a database server.
if docker run --rm -it --pull=never --read-only --cap-drop=ALL \
  --security-opt=no-new-privileges --tmpfs /tmp \
  --mount "type=bind,source=$cert,target=/tmp/supabase-ca.crt,readonly" \
  --mount "type=bind,source=$root,target=/evidence" \
  --entrypoint pg_dump public.ecr.aws/supabase/postgres:17.11.0.004 \
  -W --schema-only --schema=auth --schema=storage --no-owner --no-privileges \
  --file="/evidence/$(basename "$out")" \
  'host=aws-0-us-east-2.pooler.supabase.com port=5432 dbname=postgres user=postgres.acgqjjbrnkmeazswdnzp sslmode=verify-full sslrootcert=/tmp/supabase-ca.crt connect_timeout=10 application_name=rehearsal_schema_check options=-cdefault_transaction_read_only=on'; then
  chmod 600 "$out"
  echo 'Schema capture succeeded. Tell the assistant it is ready; do not paste its contents.'
else
  [ ! -f "$out" ] || chmod 600 "$out"
  echo 'Capture failed; any partial file is not valid comparison evidence.' >&2
  exit 1
fi
