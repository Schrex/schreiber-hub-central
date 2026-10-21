#!/bin/sh
# Explicit rehearsal-only deployment; never uses the source ref in config.toml.
set -eu
[ "$#" -eq 0 ] || { echo 'No arguments accepted.' >&2; exit 2; }
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
project='acgqjjbrnkmeazswdnzp'
echo 'Target: hub-rehearsal only. Outgoing app email will remain disabled.'
npx --yes supabase@2.121.0 functions list --project-ref "$project"
# Install the off switch BEFORE deploying anything. No provider token is handled here.
npx --yes supabase@2.121.0 secrets set --project-ref "$project" \
  EMAIL_PROVIDER=postmark EMAIL_DELIVERY_ENABLED=false \
  POSTMARK_MESSAGE_STREAM=outbound POSTMARK_FROM=no-reply@mail.schrex.com
for function in send-transactional-email process-email-queue handle-email-unsubscribe \
  request-truck decide-truck-request submit-accident-report submit-safety-violation request-safety-inspection
do
  npx --yes supabase@2.121.0 functions deploy "$function" --project-ref "$project"
done
npx --yes supabase@2.121.0 functions list --project-ref "$project"
echo 'Deployment finished. Email is still disabled; no schedules were installed.'
echo 'Provider secret, controlled delivery, webhook handling and workflow acceptance remain separate.'
