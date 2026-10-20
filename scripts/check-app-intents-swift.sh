#!/bin/bash
# Whole-module typecheck of src/app-intents, using the app target's own
# resolved build settings. The app-target Swift is an inline module: per-file
# tools (sourcekit-lsp etc.) can't see the ExpoAppIntents pod or sibling
# files, so they report "No such module"/"not in scope" that the real build
# doesn't have. This script compiles every file in one batch with the exact
# modulemaps, header/framework paths, and macro plugin the app target uses —
# the failures it reports are real (it caught a missing ExpoModulesCore
# import, the iOS 26 .hasAnyValue rename, and a metadata-processor name
# collision that per-file checks missed).
#
# Prereqs: `npx expo prebuild -p ios --no-install` + `pod install` + one
# successful xcodebuild (Debug-iphonesimulator products carry the modulemaps).
set -u
cd "$(dirname "$0")/../src" || exit 1
S=$(mktemp)
xcodebuild -workspace ios/Dexter.xcworkspace -scheme Dexter -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/build/DerivedData \
  -showBuildSettings >"$S" 2>/dev/null
[ -s "$S" ] || { echo "no build settings; run pod install + one xcodebuild first" >&2; rm -f "$S"; exit 2; }
X=$(xcrun --sdk iphonesimulator --show-sdk-path)

field() { grep -m1 "^    $1 = " "$S" | sed "s/^    $1 = //"; }
tokens() { field "$1" | xargs -n1 | tr -d '"' | grep -v '^$'; }

args=(-typecheck -parse-as-library -swift-version 5
  -target "$(field ARCHS | awk '{print $1}')-apple-ios$(field IPHONEOS_DEPLOYMENT_TARGET)-simulator" -sdk "$X"
  -D COCOAPODS -D EXPO_CONFIGURATION_DEBUG -D EX_DEV_MENU_ENABLED)

while IFS= read -r p; do args+=(-I "$p"); done < <(tokens SWIFT_INCLUDE_PATHS)
while IFS= read -r p; do args+=(-I "$p"); done < <(tokens HEADER_SEARCH_PATHS)
while IFS= read -r p; do args+=(-F "$p"); done < <(tokens FRAMEWORK_SEARCH_PATHS)
while IFS= read -r p; do args+=(-Xcc "-fmodule-map-file=$p"); done \
  < <(field OTHER_SWIFT_FLAGS | grep -o 'fmodule-map-file=[^ ]*' | sed 's/^fmodule-map-file=//' | tr -d '"')
args+=(-Xcc -Wno-incomplete-umbrella)
args+=(-Xcc "-fmodules-cache-path=$PWD/ios/build/DerivedData/ModuleCache.noindex")

FILES=()
while IFS= read -r f; do FILES+=("$f"); done \
  < <(ls app-intents/*.swift app-intents/Entities/*.swift app-intents/Queries/*.swift app-intents/Intents/*.swift)
rm -f "$S"
exec xcrun swiftc "${args[@]}" "${FILES[@]}"
