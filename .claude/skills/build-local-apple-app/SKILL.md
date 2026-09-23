---
name: build-local-apple-app
description: Build the Debug dev client locally with xcodebuild, no EAS, and launch it on this Mac ("Designed for iPad"), an iOS simulator, or a connected iPhone/iPad. Use when the user wants to run the app locally, test a branch on the Mac, simulator, or their own device, or says "build locally" or "run it on my Mac".
argument-hint: "[mac|simulator|device]"
allowed-tools: Bash, Read, AskUserQuestion
---

# Build Local Apple App

Build the Debug dev client for the current worktree and launch it against a local Metro. JS changes then reload from Metro; native changes need this skill again.

**One mechanism for every platform:** `xcodebuild` into `src/ios/build/DerivedData`, then a platform-specific install. Don't use `npx expo run:ios`:
- It can't target the Mac (no `variant=` support).
- Under Xcode 27 it installs to simulators through `devicectl`, which fails with "Install Application is not supported by this device".

## Hardcoded values

| Field | Value |
|---|---|
| Bundle ID | `com.dexterplanner` |
| Apple team | `Q77C3BA452` |
| Main checkout (source of `src/.env.local`) | `/Users/charlesburgess/Documents/GitHub/dexter` |
| Built app | `src/ios/build/DerivedData/Build/Products/Debug-<sdk>/Dexter.app` |

## Step 1: Pick the platform

Take it from the argument (`mac`, `simulator`, or `device`). If there is none, ask with `AskUserQuestion`.

## Step 2: Prepare the worktree

Run these from `src/`, skipping any step that's already satisfied:

1. If `src/.env.local` is missing, copy it from the main checkout's `src/.env.local`.
2. If `src/node_modules` is missing, run `npm ci`. Its `postinstall` applies `patches/`.
3. Run `CI=1 npx expo prebuild --platform ios --no-install` every time. It's idempotent, and `src/ios/` is gitignored.
4. Prebuild strips the trailing newline from `targets/DexterAlarmWidget/generated.entitlements`, so run `git checkout -- targets/DexterAlarmWidget/generated.entitlements`.
5. In `src/ios`, run `pod install`.

## Step 3: Start Metro

If `curl -s localhost:8081/status` doesn't print `packager-status:running`, run `npm start -- --dev-client` from `src/` as a background task. It must be this worktree's Metro: one started from another checkout serves that checkout's JS.

## Step 4: Build and launch

All three build the same way, from `src/ios`, with the destination as the only difference:

```bash
xcodebuild -workspace Dexter.xcworkspace -scheme Dexter -configuration Debug \
  -destination '<destination>' -derivedDataPath build/DerivedData \
  -allowProvisioningUpdates build
```

Run it as a background task; a clean build takes several minutes. Report `BUILD FAILED` with its ` error:` lines.

### simulator

1. List simulators with `xcrun simctl list devices available`. Names repeat across runtimes, so always use a **UDID**. Ask which device with `AskUserQuestion` (iPad for large-screen work, iPhone otherwise).
2. The destination is `id=<UDID>`. No signing is involved, so it runs inside the sandbox.
3. Install and launch. The first install on a freshly booted simulator can take a few minutes, so run it as a background task:
   ```bash
   xcrun simctl boot <UDID>   # "already booted" is fine
   open -a Simulator
   xcrun simctl install <UDID> build/DerivedData/Build/Products/Debug-iphonesimulator/Dexter.app
   xcrun simctl launch <UDID> com.dexterplanner
   ```
   If `open -a Simulator` can't find the app, keep going: `simctl` runs the simulator headless, and the app still launches. Tell the user to open Simulator.app themselves to see the window. On 2026-09-23 the Xcode 27 install here had no `Contents/Developer/Applications`.

### mac

1. The destination is `id=<id>`, where `<id>` comes from this Mac's `Designed for [iPad,iPhone]` row in `xcodebuild -workspace Dexter.xcworkspace -scheme Dexter -showdestinations`. You can't name that variant in `-destination`, because the comma inside the brackets breaks xcodebuild's parser.
2. Signing needs the keychain, which the sandbox hides, so run the build with `dangerouslyDisableSandbox`.
3. `open` rejects a bare iOS bundle ("incorrect executable format"), and `devicectl` doesn't list the Mac. Wrap the bundle the way App Store iOS apps are installed on a Mac, then open the outer bundle:
   ```bash
   pkill -f "Wrapper/Dexter.app/Dexter"   # quit a running copy; no match is fine
   rm -rf build/MacWrapper && mkdir -p build/MacWrapper/Dexter.app/Wrapper
   cp -R build/DerivedData/Build/Products/Debug-iphoneos/Dexter.app build/MacWrapper/Dexter.app/Wrapper/
   ln -s Wrapper/Dexter.app build/MacWrapper/Dexter.app/WrappedBundle
   open build/MacWrapper/Dexter.app
   ```
   Run this with `dangerouslyDisableSandbox` as well. Every rebuild needs a fresh wrap.

### device (untested; first run is its verification)

1. The phone must be connected or paired, unlocked, and in Developer Mode. Find it with `xcrun devicectl list devices`: its state must not be `unavailable`, and its Reality must not be `simulated`.
2. The destination is `id=<device UDID>`. Run the build with `dangerouslyDisableSandbox` and add `-allowProvisioningDeviceRegistration`.
3. Install and launch:
   ```bash
   xcrun devicectl device install app --device <UDID> build/DerivedData/Build/Products/Debug-iphoneos/Dexter.app
   xcrun devicectl device process launch --device <UDID> com.dexterplanner
   ```
4. The Debug build loads JS from Metro over the LAN, so the phone must be on the same network as this Mac.

After the first successful device run, correct this section and remove "untested" from its heading.

## Step 5: Report

Tell the user:
- Which platform and device is running.
- That Metro serves this worktree's JS. If the app opens on the dev-client launcher, they should pick `localhost:8081`, or this Mac's LAN IP on a device.
- That native changes need a rerun of this skill, while JS changes just reload.
- To ask when they want Metro stopped.

## Troubleshooting

- **"Unable to log in with account … login details were rejected"**: Xcode's Apple ID session expired, or the build ran inside the sandbox. Rerun outside the sandbox first. If it persists, the user must sign in again under Xcode → Settings → Accounts.
- **"Device … isn't registered in your developer account"**: add `-allowProvisioningDeviceRegistration`. That uses one of the account's device slots, so mention it.
- **`pod install` fails in ExpoModulesJSI's `create-stub-xcframework.sh` with `unknown architecture` in `libSystem.B.tbd`**: the Command Line Tools SDK is newer than Xcode's linker, because that script calls bare `clang`. Resolve `xcrun --sdk macosx --show-sdk-path` first, then rerun `pod install` with `SDKROOT=<that path>`.
