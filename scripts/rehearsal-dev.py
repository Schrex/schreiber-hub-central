#!/usr/bin/env python3
"""Launch the rehearsal frontend without writing keys or changing .env."""
import base64
import getpass
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PROJECT = "acgqjjbrnkmeazswdnzp"


def client_environment(key, inherited):
    # Decode only to reject accidental privileged/wrong-project keys. Supabase
    # remains responsible for cryptographic verification of the JWT.
    try:
        parts = key.split(".")
        if len(parts) != 3:
            raise ValueError()
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
        if payload.get("role") != "anon" or payload.get("ref") != PROJECT:
            raise ValueError()
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Use hub-rehearsal's legacy anon key, never service_role or a signing secret.") from None
    return {
        **inherited,
        "VITE_SUPABASE_URL": f"https://{PROJECT}.supabase.co",
        "VITE_SUPABASE_PROJECT_ID": PROJECT,
        "VITE_SUPABASE_PUBLISHABLE_KEY": key,
        "VITE_LOCAL_BACKEND": "false",
        "VITE_REHEARSAL_BACKEND": "true",
    }


def main():
    expected = "v" + (ROOT / ".nvmrc").read_text().strip()
    if subprocess.check_output(["node", "--version"], text=True).strip() != expected:
        raise ValueError(f"Use Node {expected} from .nvmrc first.")
    if not sys.stdin.isatty():
        raise ValueError("Run in your own Terminal for the hidden key prompt.")
    print(f"Rehearsal frontend → {PROJECT} at http://127.0.0.1:8083")
    print("This contains restored real data. Hosted isolation settings are not changed.")
    key = getpass.getpass("Rehearsal legacy anon key (hidden; NOT service_role): ").strip()
    env = client_environment(key, os.environ)
    return subprocess.call([
        "node", "node_modules/vite/bin/vite.js", "--mode", "rehearsal",
        "--host", "127.0.0.1", "--port", "8083", "--strictPort",
    ], cwd=ROOT, env=env)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)
