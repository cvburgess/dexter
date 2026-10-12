#!/usr/bin/env bash
# Ensure this worktree's local Supabase stack is running; print LOCAL_URL and
# LOCAL_KEY for swap-env.sh --local. New stacks force --runtime native; existing ones resume.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/supabase"

# Ports apply via env override only at stack creation, so hashing the worktree
# path gives each worktree a stable 5-port block — repeat runs match the saved stack.
OFF=$(( $(printf '%s' "$ROOT" | cksum | cut -d' ' -f1) % 200 ))
BASE=$((55000 + OFF * 5))
export SUPABASE_API_PORT="$BASE"
export SUPABASE_DB_PORT=$((BASE + 1))
export SUPABASE_DB_SHADOW_PORT=$((BASE + 2))
export SUPABASE_STUDIO_PORT=$((BASE + 3))
export SUPABASE_LOCAL_SMTP_PORT=$((BASE + 4))

if ! supabase status >/dev/null 2>&1; then
  supabase start --runtime native >/dev/null
else
  supabase start >/dev/null
fi

STATUS="$(supabase status --output-format json)"
URL="$(printf '%s' "$STATUS" | grep -oE '"API_URL":"[^"]*"' | head -1 | cut -d'"' -f4)"
KEY="$(printf '%s' "$STATUS" | grep -oE '"PUBLISHABLE_KEY":"[^"]*"' | head -1 | cut -d'"' -f4)"
if [[ -z "$URL" || -z "$KEY" ]]; then
  echo "error: could not read API_URL/PUBLISHABLE_KEY from supabase status" >&2
  exit 1
fi
echo "LOCAL_URL=$URL"
echo "LOCAL_KEY=$KEY"
