#!/bin/bash
# Stop hook: lint/format after Claude finishes responding. Tests are not run
# here (DEX-143) — the full suites are slow, their output was truncated and
# non-blocking anyway, and CI is the gate that counts.
set -eo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"

# Check which files changed (staged + unstaged + untracked)
CHANGED_FILES=$(git -C "$PROJECT_DIR" diff --name-only HEAD 2>/dev/null || true)
STAGED_FILES=$(git -C "$PROJECT_DIR" diff --cached --name-only 2>/dev/null || true)
UNTRACKED_FILES=$(git -C "$PROJECT_DIR" ls-files --others --exclude-standard 2>/dev/null || true)
ALL_CHANGED="$CHANGED_FILES"$'\n'"$STAGED_FILES"$'\n'"$UNTRACKED_FILES"
HAS_SRC_CHANGES=false
HAS_SUPABASE_CHANGES=false
HAS_WWW_CHANGES=false

if echo "$ALL_CHANGED" | grep -q "^src/"; then
  HAS_SRC_CHANGES=true
fi

if echo "$ALL_CHANGED" | grep -q "^supabase/"; then
  HAS_SUPABASE_CHANGES=true
fi

if echo "$ALL_CHANGED" | grep -q "^www/"; then
  HAS_WWW_CHANGES=true
fi

if [[ "$HAS_SUPABASE_CHANGES" == true ]]; then
  cd "$PROJECT_DIR/supabase"
  deno fmt .
fi

if [[ "$HAS_WWW_CHANGES" == true ]]; then
  cd "$PROJECT_DIR/www"
  deno fmt .
  deno task build 2>&1 | tail -20 >&2
fi

if [[ "$HAS_SRC_CHANGES" == true ]]; then
  cd "$PROJECT_DIR/src"
  npm run lint 2>&1 | tail -20 >&2
fi

exit 0
