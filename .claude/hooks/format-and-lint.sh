#!/bin/bash
# PostToolUse hook: auto-format and lint files after Edit/Write
set -e

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" || ! -f "$FILE_PATH" ]]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"

# Make path relative to project root for matching
REL_PATH="${FILE_PATH#$PROJECT_DIR/}"

if [[ "$REL_PATH" == src/* ]]; then
  cd "$PROJECT_DIR/src"
  # Call the tools directly rather than through `npm run`: both scripts now
  # carry their own target (`eslint .`, `prettier --write .`), so an appended
  # path would widen the run to all of /src instead of narrowing it to the
  # edited file — and `--fix`/`--write` would then rewrite the whole tree.
  npx eslint --fix "$FILE_PATH" 2>/dev/null || true
  npx prettier --write "$FILE_PATH" 2>/dev/null || true
elif [[ "$REL_PATH" == supabase/* ]]; then
  deno fmt "$FILE_PATH" 2>/dev/null || true
elif [[ "$REL_PATH" == www/* ]]; then
  deno fmt "$FILE_PATH" 2>/dev/null || true
fi

exit 0
