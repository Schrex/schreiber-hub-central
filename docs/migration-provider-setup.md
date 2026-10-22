# Independent provider setup

> Historical migration record. For current production identity and operating rules,
> use [production baseline](production-baseline.md). Do not rerun migration steps
> or treat earlier pending-state descriptions as current status.

Preparation record, 2026-10-19. No provider selected, account created, DNS changed,
credential entered, message sent or paid resource provisioned by this work.
All existing app capabilities remain in scope.

## Email first

User reports company email is Outlook and they receive GoDaddy OTP prompts.
This does not establish Microsoft tenant ownership or DNS administrator permissions.
Rechecked authenticated Lovable Cloud > Emails > Manage domains: current email
domain `notify.www.schrex.com` is Verified. No domain was disconnected or changed.
Public DNS confirms this subdomain has NS `ns5.lovable.cloud` and
`ns6.lovable.cloud`, TXT `v=spf1 include:mailgun.org ~all`, and MX
`mxa.eu.mailgun.org` / `mxb.eu.mailgun.org` (priority 10). This confirms delegation
and Mailgun-related routing, not a company-owned Mailgun account or portable keys.

The main app domain is different: `app.schreiberexcavating.com` resolves to
185.158.133.1; parent `schreiberexcavating.com` uses `ns0.wixdns.net` and
`ns1.wixdns.net`. Do not assume the GoDaddy account controls both domains.
Keep the existing delegated sender intact during migration; a separate reviewed
sending subdomain can support parallel provider tests once an owner/provider is known.

There are two delivery paths to establish: Supabase Auth confirmation/reset mail,
and application transactional notifications. A custom Auth SMTP configuration does
not replace the app's Lovable queue worker. The source Auth hook/queue arrangement
still needs verification to avoid configuring duplicate or bypassed delivery.

Required information is the company account owner, DNS administrator, desired
sender address and any existing transactional-mail account. Ordinary employee
mailbox ownership does not establish app-mail sending access.

Public DNS lookup on 2026-10-19 returned MX `mx1-us1.ppe-hosted.com` (10) and
`mx2-us1.ppe-hosted.com` (20), with nameservers `ns29.domaincontrol.com` and
`ns30.domaincontrol.com`. These public endpoints do not establish who controls
the accounts or identify the underlying employee mailbox provider. Do not change
existing MX records as part of app-mail setup.

If an existing company service fits, review its API/SMTP and webhook capabilities
before choosing a new service. Two candidates for evaluation are Resend (documented
[Supabase integration](https://supabase.com/partners/catalog/resend)) and Postmark
([Supabase SMTP](https://postmarkapp.com/support/article/integrating-postmark-with-supabase-via-smtp),
[non-delivering sandbox servers](https://postmarkapp.com/developer/user-guide/sandbox-mode/server-sandbox-mode)).
No plan, pricing, or account eligibility has been approved. Provider selection must
also cover error mapping, idempotency, suppression, unsubscribe and inbound needs;
SMTP support alone is insufficient.

## Implementation and activation order

1. Identify company owners and existing accounts; keep all credentials private.
2. Select transport and sender identity. Prepare exact provider-generated DNS records
   for review; do not invent SPF/DKIM values or replace employee-mail records.
3. Implement the selected API adapter and signed webhook verification with synthetic
   tests. Preserve delivery logs, queues, suppression and unsubscribe state.
4. Configure an isolated synthetic environment with sink/test delivery. Keep the
   real-data rehearsal separate and inert. Auth SMTP and app delivery are tested
   separately using controlled recipients and no copied employee data.
5. Verify confirmation/reset URLs, failure/retry behavior, duplicate prevention,
   bounce/complaint handling and unsubscribe behavior before any live activation.

Supabase's [custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp)
documents Auth setup. It does not establish that source Auth hooks or business
notifications are migrated.

## Other feature access

| Feature | Company access still needed | Preparation can proceed without credentials |
| --- | --- | --- |
| Google login | Google Cloud/OAuth owner and agreed synthetic origin | Opt-in Supabase route and mocked tests already prepared |
| AI | Provider/model choice, account owner, data handling and budget | Fake-response contracts; no real documents sent |
| SMS | Owned SMS account and sender/number, controlled test recipient | Stub delivery and request/error checks |
| Speech | Deepgram/ElevenLabs ownership and independent keys | Fake audio/text and fallback tests |

No test result here establishes external delivery, copied-user continuity or a
successful migration. Hosted settings, DNS, production activation and spending
remain separate from the local preparation work.
