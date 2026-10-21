#!/usr/bin/env python3
"""Private, one-attempt Postmark setup. Never sends email or enables delivery."""
import base64
from datetime import datetime, timezone
import getpass
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import urllib.request
import urllib.error
import urllib.parse

PROJECT = 'acgqjjbrnkmeazswdnzp'
SERVER = 21137606
ROOT = Path(__file__).resolve().parent.parent
URL = f'https://{PROJECT}.supabase.co/functions/v1/handle-email-suppression'
STATE = ROOT / '.local-backend' / 'postmark-webhook-setup.local'
HEADER = 'X-Postmark-Webhook-Secret'
TRIGGERS = {name: {'Enabled': name == 'SubscriptionChange'} for name in
            ('Open', 'Click', 'Delivery', 'Bounce', 'SpamComplaint', 'SubscriptionChange')}


class SafeFailure(Exception):
    """Only static non-sensitive messages may be raised with this class."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise SafeFailure('Unexpected redirect; no credentials forwarded.')


def api(token, method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request('https://api.postmarkapp.com' + path, data=data,
        method=method, headers={'Accept': 'application/json', 'Content-Type': 'application/json',
                                'X-Postmark-Server-Token': token})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=30) as response:
            raw = response.read(1024 * 1024 + 1)
            if len(raw) > 1024 * 1024:
                raise ValueError()
            result = json.loads(raw)
            if not isinstance(result, dict):
                raise ValueError()
            return result
    except urllib.error.HTTPError as error:
        # Never expose provider Message, URL, headers or response bodies.
        code = None
        try:
            detail = json.loads(error.read(65536))
            candidate = detail.get('ErrorCode')
            if type(candidate) is int and 0 <= candidate < 100000:
                code = candidate
        except Exception:
            pass
        suffix = f'; Postmark error code {code}' if code is not None else ''
        raise SafeFailure(f'Provider returned HTTP {error.code}{suffix}. No automatic retry was made.') from None
    except Exception:
        raise SafeFailure('Provider request failed or outcome is uncertain. No automatic retry was made.') from None


def install(secret):
    with tempfile.NamedTemporaryFile(mode='w', prefix='schreiber-webhook-', suffix='.env') as config:
        os.chmod(config.name, 0o600)
        config.write(f'POSTMARK_WEBHOOK_SECRET={secret}\nPOSTMARK_SERVER_ID={SERVER}\n'
                     'EMAIL_PROVIDER=postmark\nEMAIL_DELIVERY_ENABLED=false\n'
                     'EMAIL_DELIVERY_MODE=controlled\nPOSTMARK_MESSAGE_STREAM=outbound\n')
        config.flush()
        try:
            result = subprocess.run(['npx', '--yes', 'supabase@2.121.0', 'secrets', 'set',
                '--project-ref', PROJECT, '--env-file', config.name], cwd=ROOT,
                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                timeout=120, check=False)
            if result.returncode:
                raise ValueError()
        except Exception:
            raise SafeFailure('Destination secret installation failed or is uncertain. Stop for review.') from None


def service_key():
    try:
        result = subprocess.run(['npx', '--yes', 'supabase@2.121.0', 'projects',
            'api-keys', '--project-ref', PROJECT, '--output', 'json'], cwd=ROOT,
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=120, check=False)
        if result.returncode:
            raise ValueError()
        keys = json.loads(result.stdout)
        key = next(row['api_key'] for row in keys if row.get('name') == 'service_role')
        encoded = key.split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4)))
        if claims.get('ref') != PROJECT or claims.get('role') != 'service_role':
            raise ValueError()
        return key
    except Exception:
        raise SafeFailure('Could not validate destination service access for the synthetic proof.') from None


def destination(method, path, headers, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f'https://{PROJECT}.supabase.co' + path, method=method,
        data=data, headers={'Content-Type': 'application/json', **headers})
    try:
        try:
            response = urllib.request.build_opener(NoRedirect()).open(req, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read(65537)
            if len(raw) > 65536:
                raise ValueError()
            return response.status, json.loads(raw)
    except Exception:
        raise SafeFailure('Synthetic destination proof failed or is uncertain. Stop for review.') from None


def prove(secret, key_loader=service_key, send=destination):
    key = key_loader()
    recipient = 'migration-suppression-' + secrets.token_hex(16) + '@example.invalid'
    query = '/rest/v1/suppressed_emails?' + urllib.parse.urlencode({
        'email': 'eq.' + recipient, 'select': 'reason'})
    auth = {'apikey': key, 'Authorization': 'Bearer ' + key}
    def rows():
        status, result = send('GET', query, auth)
        if status != 200 or not isinstance(result, list):
            raise SafeFailure('Synthetic suppression readback failed.')
        return result
    if rows():
        raise SafeFailure('Synthetic proof address unexpectedly exists. Stop for review.')
    event = {'RecordType': 'SubscriptionChange', 'ServerID': SERVER,
        'MessageStream': 'outbound', 'Recipient': recipient,
        'ChangedAt': datetime.now(timezone.utc).isoformat(), 'SuppressSending': True,
        'SuppressionReason': 'HardBounce'}
    path = '/functions/v1/handle-email-suppression'
    for headers in ({}, {HEADER: 'invalid-synthetic-secret'}):
        status, _ = send('POST', path, headers, event)
        if status != 401:
            raise SafeFailure('Webhook authentication-denial proof failed.')
    if rows():
        raise SafeFailure('Unauthorized webhook changed synthetic suppression state.')
    for _ in range(2):
        status, result = send('POST', path, {HEADER: secret}, event)
        if status != 200 or result != {'result': 'suppressed'} or rows() != [{'reason': 'bounce'}]:
            raise SafeFailure('Authenticated webhook insert/replay proof failed.')
    # One synthetic suppression is retained as evidence; no mail is enqueued.


def record(state, phase, exclusive=False):
    state.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_CREAT | (os.O_EXCL if exclusive else os.O_TRUNC)
    with os.fdopen(os.open(state, flags, 0o600), 'w') as output:
        output.write(phase + '\n')
        output.flush()
        os.fsync(output.fileno())


def configure(token, state=STATE, call=api, installer=install, prover=prove, *, resume_if_empty=False):
    recovering = state.exists() and resume_if_empty
    recoverable = 'synthetic authentication and replay proof passed; provider creation pending'
    if recovering and (state.read_text().strip() != recoverable or state.with_suffix('.previous').exists()):
        raise SafeFailure('This recorded phase needs separate review; recovery refused.')
    if state.exists() and not recovering:
        raise SafeFailure('An earlier setup attempt is recorded. Stop: review it before retrying; do not rotate the webhook secret.')
    if not re.fullmatch(r'[A-Za-z0-9_-]{20,200}', token):
        raise SafeFailure('Invalid server-token format.')
    if call(token, 'GET', '/server').get('ID') != SERVER:
        raise SafeFailure('Wrong Postmark server. No settings changed.')
    existing = call(token, 'GET', '/webhooks?MessageStream=outbound').get('Webhooks')
    if not isinstance(existing, list):
        raise SafeFailure('Webhook inventory could not be validated. No settings changed.')
    # Conservative conflict policy: no changes to an already configured stream.
    if existing:
        raise SafeFailure('Outbound webhooks already exist. Stop for review; nothing overwritten.')
    if recovering:
        # Provider inventory above must be empty before replacing an unused secret.
        # Preserve the old record; only one reviewed recovery attempt is permitted.
        state.rename(state.with_suffix('.previous'))
    record(state, 'started: destination and provider outcome require review', exclusive=True)
    secret = secrets.token_urlsafe(32)
    installer(secret)
    record(state, 'destination configured with delivery disabled; synthetic proof pending')
    prover(secret)
    record(state, 'synthetic authentication and replay proof passed; provider creation pending')
    payload = {'Url': URL, 'MessageStream': 'outbound', 'Verify': True,
        'HttpHeaders': [{'Name': HEADER, 'Value': secret}], 'Triggers': TRIGGERS}
    # Exactly one POST; unknown results must be inspected, never blindly retried.
    created = call(token, 'POST', '/webhooks', payload)
    webhook_id = created.get('ID')
    if type(webhook_id) is not int or webhook_id <= 0:
        raise SafeFailure('Provider creation result is uncertain. Stop for review; do not rerun.')
    record(state, f'provider webhook created: {webhook_id}; readback pending')
    saved = call(token, 'GET', f'/webhooks/{webhook_id}')
    headers = saved.get('HttpHeaders', [])
    valid = (saved.get('ID') == webhook_id and saved.get('Url') == URL and
             saved.get('MessageStream') == 'outbound' and saved.get('Status') == 'verified' and
             isinstance(headers, list) and len(headers) == 1 and
             headers[0].get('Name', '').lower() == HEADER.lower() and
             secrets.compare_digest(headers[0].get('Value', ''), secret) and
             all(saved.get('Triggers', {}).get(name, {}).get('Enabled') is setting['Enabled']
                 for name, setting in TRIGGERS.items()))
    if not valid:
        raise SafeFailure('Webhook readback did not confirm the expected verified configuration. Stop for review.')
    record(state, f'verified: webhook {webhook_id}; delivery remains disabled')


def main():
    if sys.argv[1:] not in ([], ['--resume-if-empty']) or not sys.stdin.isatty():
        print('Run in your private Terminal, optionally with --resume-if-empty after review.', file=sys.stderr)
        return 2
    print('Target: schreiber-hub. Creates one suppression webhook; app email stays OFF.')
    print('Requires the reviewed suppression endpoint to be deployed first.')
    try:
        configure(getpass.getpass('Paste the current Postmark server token (hidden): ').strip(),
                  resume_if_empty=sys.argv[1:] == ['--resume-if-empty'])
    except SafeFailure as error:
        print(str(error), file=sys.stderr)
        return 1
    except (KeyboardInterrupt, EOFError):
        print('\nStopped. If setup started, do not retry until its recorded state is reviewed.')
        return 1
    except Exception:
        print('Setup incomplete. Stop for review; no sensitive diagnostics are displayed.', file=sys.stderr)
        return 1
    print('Suppression webhook configuration verified. App email remains OFF. No email was sent.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
