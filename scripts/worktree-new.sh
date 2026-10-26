#!/usr/bin/env bash
# Create an isolated worktree on a new feature/* branch cut from origin/develop,
# so parallel Claude sessions never share uncommitted files.
# Usage: scripts/worktree-new.sh <short-name>
set -euo pipefail

name="${1:?usage: scripts/worktree-new.sh <short-name>}"
case "$name" in */*|main|develop) echo "Use a short name, not a branch path." >&2; exit 2 ;; esac

root="$(git rev-parse --show-toplevel)"
branch="feature/$name"
dir="$root/.claude/worktrees/$name"

git -C "$root" fetch origin develop --quiet
git -C "$root" worktree add -b "$branch" "$dir" origin/develop
cd "$dir"
bun install --frozen-lockfile
# Writes the gitignored .local-backend workdir so this worktree can reach the
# shared local backend; it does not start or reset anything.
bun run local:prepare

echo "Ready: $dir on $branch"
echo "Start a session there with: cd \"$dir\" && claude"
