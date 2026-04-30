#!/bin/bash
# Stop hook: lint/format and run tests after Claude finishes responding
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
  if [[ -d __tests__ && -f __tests__/deno.json ]]; then
    if [[ -f .env ]]; then
      deno test --allow-all --env-file=.env --config __tests__/deno.json __tests__/ 2>&1 | tail -20 >&2 || true
    else
      deno test --allow-all --config __tests__/deno.json __tests__/ 2>&1 | tail -20 >&2 || true
    fi
  fi
fi

if [[ "$HAS_WWW_CHANGES" == true ]]; then
  cd "$PROJECT_DIR"
  deno fmt www 2>/dev/null || true
fi

if [[ "$HAS_SRC_CHANGES" == true ]]; then
  cd "$PROJECT_DIR/src"
  npm run lint 2>&1 | tail -20 >&2
  npm test 2>&1 | tail -20 >&2
fi

exit 0
