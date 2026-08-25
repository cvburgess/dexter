#!/usr/bin/env bash
#
# Capture the App Store screenshot set on iOS Simulators, strip the alpha
# channel, and verify every file before it can reach App Store Connect.
#
#   DEMO_OTP=... scripts/screenshots/capture.sh --device all --build
#
# See README.md for the failure modes this exists to prevent, and
# docs/appstore.md for the listing metadata that goes with the images.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$REPO_ROOT/scripts/screenshots"
MANIFEST="$HERE/screens.tsv"
FLATTEN="$REPO_ROOT/scripts/flatten-screenshot.swift"
OUT_ROOT="$REPO_ROOT/www/src/assets/screenshots"
MAESTRO="${MAESTRO:-$HOME/.maestro/bin/maestro}"
BUNDLE_ID="com.dexterplanner"

# Device profiles: key | simulator name | SimDeviceType | native WxH | orientation.
#
# Only a Pro Max is an accepted iPhone size — App Store Connect validates
# against a fixed list of reference resolutions, and an iPhone Air (1260x2736)
# or a non-Max 17 Pro (1206x2622) is rejected however clean the capture. Apple
# downscales the 6.9" set for smaller devices, so one iPhone entry is enough.
# The iPad 13" set is required because the app ships for iPad, and the Mac
# listing reuses it (Mac support is the iPad build on Apple Silicon).
#
# `native WxH` is what `simctl io screenshot` hands back, which is always the
# portrait framebuffer — even in landscape, where the content simply arrives
# turned 90°. The *published* size is that swapped when orientation is
# landscape, and Apple accepts either (1320x2868 / 2868x1320 for the 6.9"
# iPhone, 2064x2752 / 2752x2064 for the 13" iPad).
#
# iPad is landscape, iPhone is not, and that asymmetry is the app's, not a
# preference: `UISupportedInterfaceOrientations` in the built Info.plist is
# portrait-only, while `UISupportedInterfaceOrientations~ipad` carries both
# landscape orientations. An iPhone rotated by the menu simply keeps rendering
# portrait. Landscape also happens to be the better iPad shot — at 1366pt wide
# all four panes fit, where portrait squeezes the notes pane to nothing.
PROFILES=(
  "iphone|iPhone 17 Pro Max|com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max|1320x2868|portrait"
  "ipad|iPad Pro 13-inch (M5)|com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M5-12GB|2064x2752|landscape"
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

# --- preflight ---------------------------------------------------------------
# Everything checked here is cheaper to catch now than after a five-minute
# native build.

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

# Rows this invocation will actually capture, after --device and --screens.
selected_rows() {
  while IFS=$'\t' read -r d idx sname link anchor_by anchor; do
    case "$d" in ''|\#*) continue ;; esac
    [ "$WANT_DEVICE" = "all" ] || [ "$WANT_DEVICE" = "$d" ] || continue
    if [ -n "$ONLY_SCREENS" ] && ! printf '%s' ",$ONLY_SCREENS," | grep -q ",$idx,"; then
      continue
    fi
    printf '%s\t%s\t%s\n' "$d" "$idx" "$sname"
  done < "$MANIFEST"
}

# The Ritual tab picks morning vs evening from the wall clock (`modeForHour`,
# src/utils/ritualSteps.ts — noon is the boundary). `simctl status_bar` fakes the
# *displayed* time only, not Date.now(), so there is no way to pin this from
# outside the app: an afternoon run silently captures the evening flow, where
# `horoscope` does not exist at all and `journal` renders differently.
if [ "$(date +%-H)" -ge 12 ] && selected_rows | cut -f3 | grep -q '^ritual-'; then
  die "it is $(date +%H:%M): the Ritual tab would capture the evening flow. Re-run before 12:00 local, or exclude the ritual-* rows with --screens."
fi

# --- helpers -----------------------------------------------------------------

# Maestro's loudest log lines are harmless: it reinstalls its XCUITest runner on
# every run and polls 127.0.0.1:<port> until it answers, logging each miss at
# INFO as "[Failed] ... ConnectException". Real failures are selectors and app
# state, and Maestro saves a screenshot of the actual screen. Point at it.
report_maestro_failure() {
  local shot
  shot="$(ls -t "$HOME"/.maestro/tests/*/screenshot-*-*.png 2>/dev/null | head -1 || true)"
  warn "maestro flow failed."
  if [ -n "$shot" ]; then
    warn "the screen at the moment of failure: $shot"
  fi
  warn "'Failed to connect to 127.0.0.1' lines are normal startup polling — ignore them unless '[Done]' never appears."
}

run_flow() {
  "$MAESTRO" --device "$1" test "${@:2}" || { report_maestro_failure; exit 1; }
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
  IFS='|' read -r key name devtype native orientation <<<"$profile"
  [ "$WANT_DEVICE" = "all" ] || [ "$WANT_DEVICE" = "$key" ] || continue

  published="$(published_size "$native" "$orientation")"
  info "device: $name ($key, $orientation, publishing $published)"
  udid="$(sim_udid "$name" "$devtype")"

  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true

  # Verify geometry *before* the expensive build: a capture from the wrong
  # device is rejected no matter how good it looks. This checks the *native*
  # framebuffer, which stays portrait in either orientation.
  geom_tmp="$(mktemp -t geom).png"
  xcrun simctl io "$udid" screenshot "$geom_tmp" >/dev/null 2>&1
  geom="$(sips -g pixelWidth -g pixelHeight "$geom_tmp" | awk '/pixelWidth/{w=$2} /pixelHeight/{h=$2} END{print w "x" h}')"
  rm -f "$geom_tmp"
  [ "$geom" = "$native" ] || die "'$name' renders at $geom, expected the $native native framebuffer."

  # "Is it installed?" is not the question — a stale *debug* build installed by
  # some earlier session passes that and then drops the dev-menu sheet over the
  # login screen, which is unrecoverable from inside a flow. Ask whether the
  # installed app is a Release build instead: Release bundles the JS as
  # `main.jsbundle`, while a dev-client build ships `EXDevLauncher.bundle` and
  # `Dexter.debug.dylib` and loads its JS from Metro.
  installed="$(xcrun simctl get_app_container "$udid" "$BUNDLE_ID" 2>/dev/null || true)"
  if [ "$DO_BUILD" -eq 1 ] || [ -z "$installed" ] || [ ! -f "$installed/main.jsbundle" ]; then
    if [ -n "$installed" ] && [ ! -f "$installed/main.jsbundle" ]; then
      warn "installed app on '$name' is a dev-client build; rebuilding as Release."
    fi
    info "building (Release) for $name — several minutes"
    # Release excludes expo-dev-client: no onboarding modal, no dev-menu sheet
    # over the login screen, no floating dev-tools gear over the header button,
    # and no Metro server to keep alive. Those three were the whole reason the
    # old procedure needed percentage-coordinate taps.
    #
    # SENTRY_DISABLE_AUTO_UPLOAD keeps the @sentry/react-native Release
    # debug-symbol phase from needing a SENTRY_AUTH_TOKEN that only EAS has.
    ( cd "$REPO_ROOT/src" \
      && SENTRY_DISABLE_AUTO_UPLOAD=true npx expo run:ios --configuration Release --device "$name" ) \
      || die "build failed for $name"
  fi

  # Rotate before login, so every capture in this profile shares one orientation
  # and the app has settled into the layout by the time the first shot lands.
  if [ "$orientation" = "landscape" ]; then
    info "rotating '$name' to landscape"
    osascript "$HERE/set-orientation.applescript" "$name" "Landscape Left" \
      || die "could not rotate '$name'. The Simulator menu needs Accessibility permission for this terminal — System Settings > Privacy & Security > Accessibility."
  else
    osascript "$HERE/set-orientation.applescript" "$name" "Portrait" >/dev/null 2>&1 || true
  fi

  xcrun simctl status_bar "$udid" override \
    --time "9:41" --batteryState charged --batteryLevel 100 \
    --cellularBars 4 --wifiBars 3

  info "signing in as the demo account"
  run_flow "$udid" -e DEMO_OTP="$DEMO_OTP" "$HERE/flows/login.yaml"

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
      "$HERE/flows/goto.yaml"

    raw="$(mktemp -t shot).png"
    xcrun simctl io "$udid" screenshot "$raw" >/dev/null 2>&1
    # simctl rather than maestro's takeScreenshot: this is the native-resolution
    # capture. simctl always emits RGBA and App Store Connect rejects alpha —
    # sips cannot strip it (it re-adds alpha on every PNG export), hence the
    # CoreGraphics redraw in flatten-screenshot.swift. The same pass straightens
    # a landscape capture, which arrives as a portrait canvas turned 90°.
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

# --- verify ------------------------------------------------------------------
# A hard gate, not a report. This is the one step that catches both historical
# App Store rejections (wrong reference resolution, and a lingering alpha
# channel), and both surface identically as a vague "dimensions" error.

info "verifying $captured file(s)"
failed=0
for profile in "${PROFILES[@]}"; do
  IFS='|' read -r key name devtype native orientation <<<"$profile"
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
