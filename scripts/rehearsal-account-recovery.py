#!/usr/bin/env python3
"""Operator-run password recovery; fixed rehearsal target, no credential files."""
import base64
import getpass
import json
from pathlib import Path
import subprocess
import sys

PROJECT = "acgqjjbrnkmeazswdnzp"
ROOT = Path(__file__).resolve().parents[1]


def validate_key(key):
    try:
        parts = key.split(".")
        claims = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
        if len(parts) != 3 or claims.get("ref") != PROJECT or claims.get("role") != "service_role":
            raise ValueError()
    except (ValueError, IndexError, AttributeError, TypeError):
        raise ValueError("Use only the rehearsal legacy service_role key.") from None


SCRIPT = """
import { createClient } from '@supabase/supabase-js';
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const {key, email, password} = JSON.parse(raw);
raw = '';
const client = createClient('https://acgqjjbrnkmeazswdnzp.supabase.co', key, {
  auth: {persistSession:false, autoRefreshToken:false, detectSessionInUrl:false}
});
try {
  const matches = [];
  let complete = false;
  for (let page=1; page<=100; page++) {
    const {data,error} = await client.auth.admin.listUsers({page, perPage:100});
    if (error) throw new Error('Account lookup failed; no password update attempted.');
    matches.push(...data.users.filter(u => u.email?.toLowerCase() === email.toLowerCase()));
    if (data.users.length < 100) { complete = true; break; }
  }
  if (!complete || matches.length !== 1)
    throw new Error('Expected exactly one existing account; nothing changed.');
  const user = matches[0];
  if (!user.email_confirmed_at)
    throw new Error('Account email is not confirmed. Review the invitation status first; nothing changed.');
  if (!password) {
    console.log('PASS: one existing confirmed account found. No changes made; app admin role is not verified by this check.');
  } else {
    const {data,error} = await client.auth.admin.updateUserById(user.id, {password});
    if (error || data.user?.id !== user.id)
      throw new Error('Password update not confirmed. Do not retry automatically; inspect the outcome privately.');
    console.log('Rehearsal password update accepted. Try signing in with your new password. Roles were not changed.');
  }
} catch(error) {
  // Never print SDK response bodies, user records, keys or passwords.
  console.error(error instanceof Error && error.message.startsWith('Account lookup') ? error.message :
    error instanceof Error && /^(Expected exactly|Account email|Password update)/.test(error.message) ? error.message :
    'Request failed or connection ended. Outcome may be uncertain; do not retry automatically.');
  process.exitCode = 1;
}
"""


def main():
    if sys.argv[1:] not in ([], ["--apply"]):
        raise ValueError("Usage: python3 scripts/rehearsal-account-recovery.py [--apply]")
    if not sys.stdin.isatty():
        raise ValueError("Run in your own Terminal for hidden prompts.")
    expected = "v" + (ROOT / ".nvmrc").read_text().strip()
    if subprocess.check_output(["node", "--version"], text=True).strip() != expected:
        raise ValueError(f"Use Node {expected} first.")
    print(f"Fixed target: hub-rehearsal ({PROJECT}). Production is not contacted.")
    print("Default is lookup only. --apply changes one existing account's rehearsal password.")
    email = input("Your existing account email: ").strip()
    if "@" not in email:
        raise ValueError("An existing account email is required.")
    key = getpass.getpass("Rehearsal legacy service_role key (hidden): ").strip()
    validate_key(key)
    password = None
    if "--apply" in sys.argv:
        print("This changes the restored password hash; the original private backup is preserved.")
        print("Roles, signup, Data API and email-blocking settings are not changed.")
        if input("Retype your account email to approve this password change: ").strip() != email:
            raise ValueError("Confirmation did not match; nothing changed.")
        password = getpass.getpass("New rehearsal-only password (hidden, at least 12 characters): ")
        if len(password) < 12 or password != getpass.getpass("Repeat new password (hidden): "):
            raise ValueError("Password is too short or confirmation differs; nothing changed.")
    result = subprocess.run(["node", "--input-type=module", "-e", SCRIPT],
                            input=json.dumps(dict(key=key, email=email, password=password)),
                            text=True, cwd=ROOT)
    return result.returncode


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
    except (KeyboardInterrupt, EOFError):
        sys.exit(130)
