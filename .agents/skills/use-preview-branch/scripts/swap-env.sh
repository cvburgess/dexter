#!/usr/bin/env bash
# Toggle the Supabase prod/preview pairs in src/.env.local.
#
# Usage:
#   swap-env.sh --preview <url> <sb_publishable_key>   Point the app at a Supabase preview branch
#   swap-env.sh --prod                                 Point the app back at production
#
# Idempotent: running the same mode twice is a no-op. Only touches the four
# EXPO_PUBLIC_SUPABASE_* lines under the "# Supabase" and "# Preview branch"
# headers; every other line passes through untouched.
set -euo pipefail

MAIN_CHECKOUT="/Users/charlesburgess/Documents/GitHub/dexter"

usage() {
  echo "usage: swap-env.sh --preview <url> <sb_publishable_key> | swap-env.sh --prod" >&2
  exit 2
}

MODE="${1:-}"
PREVIEW_URL=""
PREVIEW_KEY=""
case "$MODE" in
  --preview)
    PREVIEW_URL="${2:-}"
    PREVIEW_KEY="${3:-}"
    [[ -n "$PREVIEW_URL" && -n "$PREVIEW_KEY" ]] || usage
    if [[ "$PREVIEW_KEY" != sb_publishable_* ]]; then
      echo "error: key must start with sb_publishable_ (never write anon, service_role, or sb_secret_ keys to src/.env.local)" >&2
      exit 1
    fi
    ;;
  --prod) ;;
  *) usage ;;
esac

ROOT="$(git rev-parse --show-toplevel)"
ENV_FILE="$ROOT/src/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ "$ROOT" != "$MAIN_CHECKOUT" && -f "$MAIN_CHECKOUT/src/.env.local" ]]; then
    cp "$MAIN_CHECKOUT/src/.env.local" "$ENV_FILE"
    echo "copied src/.env.local from main checkout"
  else
    echo "error: $ENV_FILE not found" >&2
    exit 1
  fi
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

section=""
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    "# Supabase") section="prod" ;;
    "# Preview branch") section="preview" ;;
    "# EXPO_PUBLIC_SUPABASE_"*) ;; # commented env line, not a section header
    "#"*) section="" ;; # any other comment header ends the section
  esac

  out="$line"
  if [[ "$section" == "prod" ]]; then
    if [[ "$MODE" == "--preview" && "$line" == EXPO_PUBLIC_SUPABASE_* ]]; then
      out="# $line"
    elif [[ "$MODE" == "--prod" && "$line" == "# EXPO_PUBLIC_SUPABASE_"* ]]; then
      out="${line#\# }"
    fi
  elif [[ "$section" == "preview" ]]; then
    if [[ "$MODE" == "--preview" ]]; then
      case "$line" in
        "EXPO_PUBLIC_SUPABASE_URL="* | "# EXPO_PUBLIC_SUPABASE_URL="*) out="EXPO_PUBLIC_SUPABASE_URL=\"$PREVIEW_URL\"" ;;
        "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="* | "# EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="*) out="EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\"$PREVIEW_KEY\"" ;;
      esac
    elif [[ "$MODE" == "--prod" && "$line" == EXPO_PUBLIC_SUPABASE_* ]]; then
      out="# $line"
    fi
  fi
  printf '%s\n' "$out" >>"$TMP"
done <"$ENV_FILE"

if ! grep -q '^EXPO_PUBLIC_SUPABASE_URL=' "$TMP" || ! grep -q '^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' "$TMP"; then
  echo "error: no active EXPO_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY pair after the swap." >&2
  echo "The expected pair is missing from src/.env.local; restore it from $MAIN_CHECKOUT/src/.env.local and rerun." >&2
  exit 1
fi

if cmp -s "$ENV_FILE" "$TMP"; then
  echo "src/.env.local already in the desired state; no changes made"
else
  mv "$TMP" "$ENV_FILE"
  trap - EXIT
  if [[ "$MODE" == "--prod" ]]; then
    echo "src/.env.local now points at production"
  else
    echo "src/.env.local now points at preview: $PREVIEW_URL"
  fi
fi
echo "Restart the Expo dev server to pick up the change (Expo reads .env only at startup)."
