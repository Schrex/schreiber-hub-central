# Postmark setup record — 2026-10-19

## Current verified status

DKIM and Return-Path for mail.schrex.com are verified. Account approval is complete.
An isolated Supabase hub-email-test project (pwaubtyinxuncelqzwlx) now uses Postmark
SMTP. One controlled password-recovery retry after approval is marked Delivered in
Postmark Activity. Inbox receipt and the complete reset/login flow remain unverified.
Production and the real-data Supabase hub-rehearsal remain unchanged. See the latest
DEVELOPMENT_PROGRESS.md milestone. The following inspection notes describe the
earlier state and pending gates at that time; they are retained as history.

Authenticated UI inspection only. The signed-in account shows Owner access.
Existing server `hub-rehearsal` (21137606) has default Transactional (`outbound`),
Broadcast (`broadcast`) and Inbound streams. SMTP is already enabled; open and link
tracking are disabled. No settings or tokens were changed or read.

Account is in **test mode**, with a displayed 100-email send/process limit and
restricted outbound destinations. User completed account-email confirmation;
reloaded dashboard confirms the confirmation banner is gone, replaced by a domain
authentication recommendation. Account remains in test mode; DKIM and Return-Path
remain Inactive. Test mode is not a non-delivering sandbox: the UI says it can send to
permitted domains. Existing server delivery type was not explicitly confirmed in
the inspected UI; do not send to it on the assumption it is a Sandbox server.
[Sandbox servers](https://postmarkapp.com/developer/user-guide/sandbox-mode/server-sandbox-mode)
never deliver to inboxes, still count toward volume, and cannot be converted from
an existing Live server. No new server was created.

## Pending DNS: existing mail.schrex.com domain

Both `mail.schrex.com` and `schrex.com` exist in Sender Signatures with DKIM and
Return-Path Not Verified. The subdomain has no individual sender signatures.
Use the already-added `mail.schrex.com` for preparation; no sender address has
been selected or enabled. The root-domain entry is not an instruction to change
company mailbox routing.

Exact records shown by [Postmark DNS Settings](https://account.postmarkapp.com/signature_domains/8195634):

| Type | Host relative to schrex.com | Value |
| --- | --- | --- |
| TXT | `20261019163211pm._domainkey.mail` | Public DKIM key below |
| CNAME | `pm-bounces.mail` | `pm.mtasv.net` |

Public DKIM TXT value (not a credential):

```text
k=rsa;p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCGlLhQg26KIlkSZyPxTyUiSFxGx/Wp6kI/XxIH7q32wtapBooK9RQ4pnY6B5Bb2uzjRKTr1vLCJdvsLk31SlkyHRMMYBHQ5f7ZUu19ySEhbLyne2Q14rUm6JpuSaSH8JeLnvuKo5r65wENnBZm28fCiQPQtzewFVV+CG+DEhtGRwIDAQAB
```

Recheck these provider-generated values before applying because keys can rotate.
DNS access is pending; none of these records has been changed by this work.
Check for existing records before adding them. Leave root MX/SPF, domain
nameservers, website records and Lovable's `notify.www.schrex.com` delegation intact.
The UI says no extra SPF record is required. Its DMARC warning is not a complete
parent-domain policy audit; do not introduce a new policy without reviewing existing
mail sources and domain-owner requirements.

## Auth SMTP preparation (not applied)

Following [Postmark's Supabase SMTP guide](https://postmarkapp.com/support/article/integrating-postmark-with-supabase-via-smtp):

- Host: `smtp.postmarkapp.com`; port: `587`.
- Sender: an approved address on the verified sender domain; name still to agree.
- Username/password: stream SMTP Access Key/Secret Key, issued and entered privately
  only when ready; none generated or captured here.
- Use a transactional stream. Keep open/link tracking disabled for Auth links.
- Confirm actual source Auth-hook behavior before selecting SMTP versus a queued
  send-email hook. Configuring SMTP does not replace the app queue worker.

Do not enable SMTP on the real-data rehearsal merely to test delivery. Synthetic
Auth tests need an isolated environment, verified delivery mode and controlled
recipients. Existing source mail remains unchanged.

## Remaining gates

Actual server delivery-type verification (or a separate
explicit Sandbox server); DNS access and verification; company sender choice;
private scoped credentials; Auth flow review; Postmark adapter and webhook behavior;
delivery-time suppression and queue duplicate/reconciliation handling. No account
approval request, subscription upgrade, token creation, live send, DNS edit or
Supabase setting change occurred during this inspection.
