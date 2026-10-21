#!/usr/bin/env python3
"""Private operator-run token installation; never deploys or enables delivery."""
import getpass
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

PROJECT = 'acgqjjbrnkmeazswdnzp'
ROOT = Path(__file__).resolve().parent.parent


def install(token):
    if not re.fullmatch(r'[A-Za-z0-9_-]{20,200}', token):
        raise ValueError('Invalid token format; paste only the server token.')
    # NamedTemporaryFile creates owner-only permissions. No token in argv/env/logs.
    with tempfile.NamedTemporaryFile(mode='w', prefix='schreiber-postmark-', suffix='.env') as config:
        os.chmod(config.name, 0o600)
        config.write('POSTMARK_SERVER_TOKEN=' + token + '\n'
                     'EMAIL_PROVIDER=postmark\nEMAIL_DELIVERY_ENABLED=false\n'
                     'EMAIL_DELIVERY_MODE=controlled\nPOSTMARK_MESSAGE_STREAM=outbound\n'
                     'POSTMARK_FROM=no-reply@mail.schrex.com\n')
        config.flush()
        result = subprocess.run(
            ['npx', '--yes', 'supabase@2.121.0', 'secrets', 'set',
             '--project-ref', PROJECT, '--env-file', config.name],
            cwd=ROOT, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, timeout=120, check=False)
        if result.returncode:
            raise RuntimeError('Installation failed. Check Supabase login and network access; do not paste the token into chat.')


def main():
    if len(sys.argv) != 1 or not sys.stdin.isatty():
        print('Run this script without arguments in your private Terminal.', file=sys.stderr)
        return 2
    print('Target: hub-rehearsal. This installs Postmark settings with delivery OFF.')
    try:
        token = getpass.getpass('Paste the NEW Postmark server token (input hidden): ').strip()
        install(token)
    except (KeyboardInterrupt, EOFError):
        print('\nCancelled. Verify configuration before retrying if installation had begun.')
        return 1
    except Exception:
        # Never print exception text or subprocess output that could include secrets.
        print('Installation did not complete successfully. Check login/network and retry privately.', file=sys.stderr)
        return 1
    print('Token installed in hub-rehearsal. Email delivery is OFF. No functions deployed or email sent.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
