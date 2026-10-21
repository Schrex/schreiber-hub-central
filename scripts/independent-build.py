#!/usr/bin/env python3
"""Build locally with an explicit destination and a hidden client-key prompt."""
import argparse
import getpass
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--url", required=True)
    args = parser.parse_args()
    if not sys.stdin.isatty():
        raise ValueError("Use your Terminal for the hidden client-key prompt.")
    expected = "v" + (ROOT / ".nvmrc").read_text().strip()
    if subprocess.check_output(["node", "--version"], text=True).strip() != expected:
        raise ValueError(f"Use Node {expected} from .nvmrc.")
    if subprocess.check_output(["bun", "--version"], text=True).strip() != "1.3.14":
        raise ValueError("Use Bun 1.3.14 and bun install --frozen-lockfile.")
    key = getpass.getpass("Destination legacy anon client key (hidden): ").strip()
    # Pass only the OS/runtime essentials; never inherit VITE_ or server secrets.
    env = {name: os.environ[name] for name in ("PATH", "HOME", "TMPDIR", "SYSTEMROOT") if name in os.environ}
    return subprocess.run(
        ["node", "scripts/independent-build.mjs"], cwd=ROOT, env=env,
        input=json.dumps({"project": args.project, "url": args.url, "key": key}), text=True,
    ).returncode


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.CalledProcessError):
        print("Build preflight failed. Check Node/Bun versions and use a private Terminal.", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)
