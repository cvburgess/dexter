#!/usr/bin/env bash
# DEMO_OTP=... scripts/screenshots/capture.sh --device all --build
# Failure modes: README.md; listing metadata: docs/appstore.md.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$REPO_ROOT/scripts/screenshots"
MANIFEST="$HERE/screens.tsv"
FLATTEN="$REPO_ROOT/scripts/flatten-screenshot.swift"
OUT_ROOT="$REPO_ROOT/www/src/assets/screenshots"
MAESTRO="${MAESTRO:-$HOME/.maestro/bin/maestro}"
BUNDLE_ID="com.dexterplanner"
# One file per simulator, touched after each successful build — see the
# staleness check below for why the installed bundle can't answer this.
BUILD_STAMPS="$HOME/.cache/dexter-screenshots"

# key | name | SimDeviceType | native WxH | orientation | drawer. Native size is
# the portrait framebuffer even in landscape; accepted sizes and why: README.md.
PROFILES=(
  "iphone|iPhone 17 Pro Max|com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max|1320x2868|portrait|sheet"
  "ipad|iPad Pro 13-inch (M5)|com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M5-12GB|2064x2752|landscape|pane"
)

WANT_DEVICE="all"
DO_BUILD=0
ONLY_SCREENS=""

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33mwarn:\033[0m %s\n' "$*" >&2; }

usage() {
  cat <<EOF
usage: DEMO_OTP=... $0 [options]

  --device iphone|ipad|all   which set to capture (default: all)
  --build                    force a rebuild even if the app is installed
  --screens 01,03            capture only these manifest indexes
  -h, --help                 this
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --device) WANT_DEVICE="${2:-}"; shift 2 ;;
    --build) DO_BUILD=1; shift ;;
    --screens) ONLY_SCREENS="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "unknown argument: $1" ;;
  esac
done

# --- preflight: cheaper to catch here than after a five-minute build ---------

[ -n "${DEMO_OTP:-}" ] || die "DEMO_OTP is not set. It is a Supabase function secret — ask for it, never commit it."
[ -x "$MAESTRO" ] || command -v maestro >/dev/null 2>&1 || die "maestro not found at $MAESTRO. Install: curl -fsSL https://get.maestro.mobile.dev | bash"
[ -x "$MAESTRO" ] || MAESTRO="$(command -v maestro)"
command -v xcrun >/dev/null 2>&1 || die "xcrun not found — install Xcode."
[ -f "$FLATTEN" ] || die "missing $FLATTEN"
[ -f "$MANIFEST" ] || die "missing $MANIFEST"

# The demo account only exists in production. A preview branch has its own
# seeded copy, but not the one the App Store listing and the marketing site show.
ENV_LOCAL="$REPO_ROOT/src/.env.local"
[ -f "$ENV_LOCAL" ] || die "src/.env.local is missing — run .claude/skills/use-preview-branch/scripts/swap-env.sh --prod"
grep -qE '^EXPO_PUBLIC_SUPABASE_URL=.*(api\.dexterplanner\.com|isreileykodwkyedcewv)' "$ENV_LOCAL" \
  || die "src/.env.local does not point at production. Run: .claude/skills/use-preview-branch/scripts/swap-env.sh --prod"

# AlarmKit landed in iOS 26; the task "Add alarm" row is hidden below it, so an
# older runtime silently captures a different screen.
xcrun simctl list runtimes 2>/dev/null | grep -qE 'iOS 2[6-9]' \
  || die "no iOS 26+ runtime installed — AlarmKit rows are hidden below iOS 26."

# Rotation is AppleScript over Simulator's menu (no simctl verb) and needs
# Accessibility permission — without it the click "succeeds" and stays portrait.
if printf '%s\n' "${PROFILES[@]}" | grep -q '|landscape|'; then
  osascript -e 'tell application "System Events" to name of first process' >/dev/null 2>&1 \
    || die "this terminal lacks Accessibility permission, which the orientation menu needs. Grant it under System Settings > Privacy & Security > Accessibility."
fi

# Reads simctl's JSON; named here so a broken Xcode CLT install fails in a
# second rather than inside the device lookup.
[ -x /usr/bin/python3 ] || die "/usr/bin/python3 is missing — install the Xcode command line tools (xcode-select --install)."

# One scratch dir for the run — `$(mktemp -t x).png` would write to a path
# mktemp never created, leaking an empty temp file per screenshot.
WORK_DIR="$(mktemp -d -t capture)"
trap 'rm -rf "$WORK_DIR"' EXIT

# Marks the start of this run, so a failure report can tell this run's Maestro
# screenshots from every earlier one still sitting in ~/.maestro/tests.
RUN_MARKER="$WORK_DIR/started"
: > "$RUN_MARKER"

# MAESTRO_-prefixed vars reach flows by name; `-e DEMO_OTP=…` would leave the
# secret readable in `ps` output for the whole run.
export MAESTRO_DEMO_OTP="$DEMO_OTP"

# --- helpers -----------------------------------------------------------------

# Maestro's "[Failed] ... ConnectException" startup lines are harmless runner
# polling; real failures leave a screenshot of the actual screen — point at it.
report_maestro_failure() {
  local shot
  # Newer than this run only — the newest shot overall may be last week's run.
  # -print0/-0 because Maestro names these with a ❌ and bracketed flow name.
  shot="$(find "$HOME/.maestro/tests" -name 'screenshot-*.png' -newer "$RUN_MARKER" -print0 2>/dev/null \
    | xargs -0 ls -t 2>/dev/null | head -1 || true)"
  warn "maestro flow failed."
  if [ -n "$shot" ]; then
    warn "the screen at the moment of failure: $shot"
  else
    warn "no failure screenshot from this run — check ~/.maestro/tests/ for the newest directory."
  fi
  warn "'Failed to connect to 127.0.0.1' lines are normal startup polling — ignore them unless '[Done]' never appears."
}

run_flow() {
  # </dev/null: callers sit inside a `while read` loop over the manifest, and a
  # subprocess touching stdin would silently swallow rows.
  "$MAESTRO" --device "$1" test "${@:2}" </dev/null \
    || { report_maestro_failure; exit 1; }
}

# The published size: the native framebuffer, swapped when we shoot landscape.
published_size() {
  case "$2" in
    landscape) printf '%sx%s' "${1#*x}" "${1%x*}" ;;
    *) printf '%s' "$1" ;;
  esac
}

# Resolve a simulator UDID by exact name, creating the device if it is absent.
sim_udid() {
  local name="$1" type="$2" udid
  udid="$(xcrun simctl list devices --json \
    | /usr/bin/python3 -c 'import json,sys
name = sys.argv[1]
data = json.load(sys.stdin)["devices"]
for runtime, devices in sorted(data.items(), reverse=True):
    for d in devices:
        if d["name"] == name and d.get("isAvailable"):
            print(d["udid"]); raise SystemExit
' "$name")"
  if [ -z "$udid" ]; then
    info "creating simulator '$name'"
    local runtime
    runtime="$(xcrun simctl list runtimes | grep -oE 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-2[6-9][0-9-]*' | tail -1)"
    [ -n "$runtime" ] || die "no iOS 26+ runtime to create '$name' against."
    udid="$(xcrun simctl create "$name" "$type" "$runtime")"
  fi
  printf '%s' "$udid"
}

# --- capture -----------------------------------------------------------------

captured=0

for profile in "${PROFILES[@]}"; do
  IFS='|' read -r key name devtype native orientation drawer <<<"$profile"
  [ "$WANT_DEVICE" = "all" ] || [ "$WANT_DEVICE" = "$key" ] || continue

  published="$(published_size "$native" "$orientation")"
  info "device: $name ($key, $orientation, publishing $published)"
  udid="$(sim_udid "$name" "$devtype")"

  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true

  # Verify geometry before the expensive build — against the *native*
  # framebuffer, which stays portrait in either orientation.
  geom_tmp="$WORK_DIR/geom.png"
  xcrun simctl io "$udid" screenshot "$geom_tmp" >/dev/null 2>&1
  geom="$(sips -g pixelWidth -g pixelHeight "$geom_tmp" | awk '/pixelWidth/{w=$2} /pixelHeight/{h=$2} END{print w "x" h}')"
  rm -f "$geom_tmp"
  [ "$geom" = "$native" ] || die "'$name' renders at $geom, expected the $native native framebuffer."

  # "Installed" is not enough — a dev-client build drops the dev-menu sheet over
  # login. Release bundles `main.jsbundle`; dev clients ship `EXDevLauncher.bundle`.
  installed="$(xcrun simctl get_app_container "$udid" "$BUNDLE_ID" 2>/dev/null || true)"

  # Staleness against this script's own build stamp, never the bundle's mtime —
  # reinstalling an old build refreshes mtime. Why a stale Release bites: README.md.
  stamp="$BUILD_STAMPS/$udid.built"
  stale=0
  if [ ! -f "$stamp" ]; then
    stale=1
  elif [ -n "$(find "$REPO_ROOT/src/app" "$REPO_ROOT/src/components" \
                    "$REPO_ROOT/src/utils" "$REPO_ROOT/src/hooks" "$REPO_ROOT/src/api" \
                    -path '*__tests__*' -prune -o \
                    \( -name '*.ts' -o -name '*.tsx' \) -newer "$stamp" -print -quit \
                    2>/dev/null)" ]; then
    stale=1
  fi

  if [ "$DO_BUILD" -eq 1 ] || [ -z "$installed" ] || [ ! -f "$installed/main.jsbundle" ] || [ "$stale" -eq 1 ]; then
    if [ -n "$installed" ] && [ ! -f "$installed/main.jsbundle" ]; then
      warn "installed app on '$name' is a dev-client build; rebuilding as Release."
    elif [ "$stale" -eq 1 ]; then
      warn "installed app on '$name' predates the current app source; rebuilding."
    fi
    info "building (Release) for $name — several minutes"
    # Release excludes expo-dev-client's overlays; SENTRY_DISABLE_AUTO_UPLOAD
    # skips a phase needing EAS's token; --no-bundler — Release carries main.jsbundle.
    ( cd "$REPO_ROOT/src" \
      && SENTRY_DISABLE_AUTO_UPLOAD=true npx expo run:ios --no-bundler --configuration Release --device "$name" ) \
      || die "build failed for $name"
    # Only after the build succeeds — a failed build must stay stale, or the
    # next run would happily capture the previous binary.
    mkdir -p "$BUILD_STAMPS" && : > "$stamp"
  fi

  # Login runs in portrait on every profile: Maestro's tap on a system alert
  # misses on a rotated device, and the AlarmKit prompt lands around login.
  osascript "$HERE/set-orientation.applescript" "$name" "Portrait" >/dev/null 2>&1 || true

  xcrun simctl status_bar "$udid" override \
    --time "9:41" --batteryState charged --batteryLevel 100 \
    --cellularBars 4 --wifiBars 3

  info "signing in as the demo account"
  run_flow "$udid" "$HERE/flows/login.yaml"

  # Only after login, so every capture still shares one settled orientation.
  if [ "$orientation" = "landscape" ]; then
    info "rotating '$name' to landscape"
    osascript "$HERE/set-orientation.applescript" "$name" "Landscape Left" \
      || die "could not rotate '$name'. The Simulator menu needs Accessibility permission for this terminal — System Settings > Privacy & Security > Accessibility."
  fi

  out_dir="$OUT_ROOT/$key"
  mkdir -p "$out_dir"

  while IFS=$'\t' read -r d idx sname link anchor_by anchor; do
    case "$d" in ''|\#*) continue ;; esac
    [ "$d" = "$key" ] || continue
    if [ -n "$ONLY_SCREENS" ] && ! printf '%s' ",$ONLY_SCREENS," | grep -q ",$idx,"; then
      continue
    fi

    info "  $idx-$sname  ($link)"
    run_flow "$udid" \
      -e LINK="$link" -e ANCHOR="$anchor" -e ANCHOR_BY="$anchor_by" \
      -e DRAWER="$drawer" \
      "$HERE/flows/goto.yaml"

    raw="$WORK_DIR/raw.png"
    xcrun simctl io "$udid" screenshot "$raw" >/dev/null 2>&1
    # simctl always emits RGBA and sips re-adds alpha on every export — hence
    # the CoreGraphics redraw, which also straightens a landscape capture.
    if [ "$orientation" = "landscape" ]; then
      swift "$FLATTEN" "$raw" "$out_dir/$idx-$sname.png" --rotate-ccw
    else
      swift "$FLATTEN" "$raw" "$out_dir/$idx-$sname.png"
    fi
    rm -f "$raw"
    captured=$((captured + 1))
  done < "$MANIFEST"
done

[ "$captured" -gt 0 ] || die "nothing captured — check --device and --screens."

# --- verify: a hard gate — both historical rejections (wrong resolution, and
# lingering alpha) surface as the same vague "dimensions" error ---------------

info "verifying $captured file(s)"
failed=0
for profile in "${PROFILES[@]}"; do
  IFS='|' read -r key name devtype native orientation drawer <<<"$profile"
  [ -d "$OUT_ROOT/$key" ] || continue
  expected="$(published_size "$native" "$orientation")"
  for f in "$OUT_ROOT/$key"/*.png; do
    [ -e "$f" ] || continue
    read -r w h a <<<"$(sips -g pixelWidth -g pixelHeight -g hasAlpha "$f" \
      | awk '/pixelWidth/{w=$2} /pixelHeight/{h=$2} /hasAlpha/{a=$2} END{print w, h, a}')"
    if [ "${w}x${h}" != "$expected" ] || [ "$a" != "no" ]; then
      printf '  \033[31mFAIL\033[0m %s — %sx%s, alpha=%s (want %s, alpha=no)\n' \
        "${f#"$REPO_ROOT"/}" "$w" "$h" "$a" "$expected"
      failed=1
    else
      printf '  \033[32mok\033[0m   %s — %sx%s, no alpha\n' "${f#"$REPO_ROOT"/}" "$w" "$h"
    fi
  done
done

[ "$failed" -eq 0 ] || die "some screenshots would be rejected by App Store Connect."

info "done. Read the images before uploading — a stray dialog or an open menu is invisible in an exit code."
