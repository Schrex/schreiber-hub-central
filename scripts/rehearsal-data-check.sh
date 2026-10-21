#!/bin/sh
# Read-only destination capture and offline content comparison. No database writes.
set -eu
[ "$#" -eq 0 ] || { echo 'No arguments accepted.' >&2; exit 2; }
[ -t 0 ] && [ -t 1 ] || { echo 'Run in your own interactive Terminal.' >&2; exit 2; }
umask 077
cd "$(dirname "$0")/.."
cert='/Users/sumanththota/Downloads/prod-ca-2021.crt'
root='/Users/sumanththota/Schrex/archive/database-2026-10-19/inspection'
[ -f "$cert" ] && [ -d "$root" ] && [ ! -L "$root" ] || exit 2
name="destination-data-$(date -u +%Y%m%dT%H%M%SZ).sql"
[ ! -e "$root/$name" ] && [ ! -e "$root/$name.partial" ] || exit 2
: > "$root/$name.partial"
echo 'Read-only verification of hub-rehearsal (acgqjjbrnkmeazswdnzp).'
echo 'Business/account rows will be captured only into your private archive and compared locally. No rows or hashes are printed.'
echo 'Enter the database password at the hidden prompt.'
if docker run --rm -it --pull=never --read-only --cap-drop=ALL \
 --security-opt=no-new-privileges --tmpfs /tmp \
 --mount "type=bind,source=$cert,target=/tmp/supabase-ca.crt,readonly" \
 --mount "type=bind,source=$root,target=/evidence" \
 --entrypoint pg_dump public.ecr.aws/supabase/postgres:17.11.0.004 \
 -W --data-only --no-owner --no-privileges \
 --table='public.*' --table=auth.users --table=auth.identities \
 --file="/evidence/$name.partial" \
 'host=aws-0-us-east-2.pooler.supabase.com port=5432 dbname=postgres user=postgres.acgqjjbrnkmeazswdnzp sslmode=verify-full sslrootcert=/tmp/supabase-ca.crt connect_timeout=10 application_name=rehearsal_data_check options=-cdefault_transaction_read_only=on'; then
 mv "$root/$name.partial" "$root/$name"
 node scripts/migration-reconcile.mjs "$name"
else
 echo 'Capture failed; partial evidence is not a valid comparison. No database writes attempted.' >&2
 exit 1
fi
