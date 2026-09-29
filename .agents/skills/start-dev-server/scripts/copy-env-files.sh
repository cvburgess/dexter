#!/usr/bin/env bash
# Copy every gitignored .env* file from the main checkout into this worktree
# where it's missing. Never overwrites; a no-op in the main checkout.
set -euo pipefail

MAIN_CHECKOUT="/Users/charlesburgess/Documents/GitHub/dexter"

ROOT="$(git rev-parse --show-toplevel)"
if [[ "$ROOT" == "$MAIN_CHECKOUT" ]]; then
  echo "in the main checkout; nothing to copy"
  exit 0
fi

copied=0
while IFS= read -r src; do
  rel="${src#"$MAIN_CHECKOUT"/}"
  dest="$ROOT/$rel"
  if [[ ! -e "$dest" ]]; then
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "copied $rel"
    copied=$((copied + 1))
  fi
done < <(find "$MAIN_CHECKOUT" -maxdepth 3 -name '.env*' -type f \
  -not -path '*/node_modules/*' -not -path "$MAIN_CHECKOUT/.claude/*")

[[ "$copied" -gt 0 ]] || echo "all .env files already present"
