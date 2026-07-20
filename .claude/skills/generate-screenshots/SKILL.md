---
name: generate-screenshots
description: Capture App Store screenshots for iOS on a simulator, at accepted dimensions with no alpha channel. Use when the user wants new App Store screenshots, is preparing a submission, or hit a "wrong dimensions" rejection from App Store Connect.
allowed-tools: Bash, Read, Write, Edit, Glob
---

# Generate App Store Screenshots

Captures the App Store screenshot set on an iOS Simulator, flattens the alpha
channel, and verifies every file before it reaches App Store Connect.

Output lands in `www/src/assets/screenshots/`, which `www/_config.ts`'s
`site.add("/assets")` auto-publishes — so one set powers both the marketing site
and the App Store listing.

## Why this is fiddly

App Store Connect rejects screenshots for two unrelated reasons, and both report
as a dimensions/format error. Both have bitten this project.

**1. Only a Pro Max produces an accepted size.** App Store Connect validates
against a fixed list of reference-device resolutions. Most iPhones are not on it:

| Device | Native | Accepted? |
|---|---|---|
| iPhone 17 Pro Max / 16 Pro Max | 1320 × 2868 | ✅ 6.9" slot |
| iPhone Air | 1260 × 2736 | ❌ |
| iPhone 17 Pro | 1206 × 2622 | ❌ |

A flawless native capture from an Air or a non-Max Pro is still rejected. Apple
downscales the 6.9" set for smaller devices, so **only 1320 × 2868 is needed** —
the optional 6.5" (1242 × 2688) set is deliberately not maintained.

**2. `simctl` screenshots always carry alpha**, and App Store Connect rejects
that. `sips` *cannot* strip it — it re-adds alpha on every PNG export. Use
`scripts/flatten-screenshot.swift` (CoreGraphics; no external dependencies).

Never skip step 6. It catches both failure modes in one command.

## Prerequisites

- **Xcode with an iOS 26+ runtime.** Task alarms use AlarmKit; the "Add alarm"
  row is hidden below iOS 26.
- **maestro** for UI navigation (`~/.maestro/bin/maestro`).
- **`DEMO_OTP`** — ask the user; it is a function secret. Never write it into a
  committed file.
- `src/.env.local` must point at **production** (`api.dexterplanner.com`), where
  the demo account lives — not a preview branch. Check with
  `grep -n "SUPABASE_URL" src/.env.local`.

## Procedure

### 1. Reconcile and reseed the demo account

`supabase/scripts/seed-demo.ts` deletes and re-inserts every row for
`demo@dexterplanner.com`. **Reconcile `supabase/scripts/demoData.ts` to the live
data before reseeding, not after** — otherwise hand-edits made in the app are
silently reverted and the screenshots capture stale state.

Diff live against the seed first (project `isreileykodwkyedcewv`):

```sql
select t.title, t.priority, t.status,
       (t.scheduled_for - current_date) as sched_off,
       (t.due_on - current_date) as due_off, l.title as list
from tasks t left join lists l on l.id = t.list_id
where t.user_id = (select id from auth.users where email='demo@dexterplanner.com')
order by t.scheduled_for nulls last, t.priority, t.title;
```

If the only delta is a few added rows, insert those directly instead of a full
reseed — that avoids resetting the demo password. Otherwise:

```sh
cd supabase/scripts
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_OTP=... deno task seed-demo
```

Day offsets are relative to "today", so dates always look current.

### 2. Create the simulator (once)

```sh
xcrun simctl create "iPhone 17 Pro Max" \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max \
  com.apple.CoreSimulator.SimRuntime.iOS-26-5
```

Capture the returned UDID — pass it explicitly to every `simctl`/`maestro` call
rather than relying on `booted`, since other simulators may also be running.

**Verify the geometry before the expensive build:**

```sh
xcrun simctl boot <UDID>
xcrun simctl io <UDID> screenshot /tmp/geom.png
sips -g pixelWidth -g pixelHeight /tmp/geom.png   # must be 1320 × 2868
```

### 3. Build and launch

```sh
cd src && npx expo run:ios --device "iPhone 17 Pro Max"
```

A clean build takes several minutes. Run it in the background and wait on a
completion signal rather than polling.

### 4. Log in and clear dev-client chrome

Write the flows below to a **scratchpad directory, not the repo** — they contain
`DEMO_OTP`. Run each with:

```sh
maestro --device <UDID> test <flow>.yaml
```

`login.yaml` — the expo-dev-client onboarding modal appears on first launch, and
dismissing it reveals the dev menu sheet underneath, which must also be closed:

```yaml
appId: com.dexterplanner
---
- tapOn: {text: "Continue", optional: true}
- tapOn: {point: "91%,47%", optional: true}   # dev menu close (X)
- extendedWaitUntil: {visible: {id: "login-email-input"}, timeout: 20000}
- tapOn: {id: "login-email-input"}
- inputText: "demo@dexterplanner.com"
- tapOn: {text: "Sign up or log in to start planning", optional: true}
- tapOn: {id: "login-email-button"}
- extendedWaitUntil: {visible: {id: "login-code-input"}, timeout: 20000}
- tapOn: {id: "login-code-input"}
- inputText: "<DEMO_OTP>"
- tapOn: {id: "login-verify-button"}
- extendedWaitUntil: {notVisible: {id: "login-verify-button"}, timeout: 30000}
```

Gotchas: `hideKeyboard` fails on these inputs (custom input) — tap static text
instead. The flow is **not idempotent**; if it fails partway, screenshot the
simulator to see the actual state before re-running.

`prep.yaml` — grant AlarmKit up front so its system dialog cannot appear
mid-capture, and switch off the floating dev-tools gear, which otherwise sits
over the header button in **every** screenshot:

```yaml
appId: com.dexterplanner
---
- tapOn: {text: "Allow", optional: true}
- tapOn: {point: "90%,11%"}                    # open dev menu
- extendedWaitUntil: {visible: {text: "Tools button"}, timeout: 15000}
- tapOn: {point: "85%,95%"}                    # the switch itself
- tapOn: {point: "91%,47%", optional: true}    # close (X)
```

Tapping the "Tools button" *label* does nothing — the tap must land on the
switch control. Confirm the gear is gone before capturing.

### 5. Set the status bar, then navigate and capture

```sh
xcrun simctl status_bar <UDID> override \
  --time "9:41" --batteryState charged --batteryLevel 100 \
  --cellularBars 4 --wifiBars 3
```

The four screens, and how to reach each. The top-right circular control is
`DayViewSwitcher` — a native `IconMenu` at roughly `91%,10%` offering Tasks /
Notes / Journal / Calendar / Backlog:

| # | Screen | Navigation | Wait for |
|---|---|---|---|
| 01 | Today | tab bar `Today` | `Reply to beta tester feedback` |
| 02 | Journal | switcher → `Journal` | `Today I am grateful for` |
| 03 | Backlog | switcher → `Tasks`, switcher → `Backlog` | `File Q2 expense report` |
| 04 | New Task | swipe sheet down, tap `New Task` | `What needs to be done?` |

The button label is `New Task`, not `+ New Task` — the `+` is a separate icon.

Capture each with `simctl` (native resolution; better than maestro's own
screenshot), then flatten straight into place:

```sh
xcrun simctl io <UDID> screenshot /tmp/raw.png
swift scripts/flatten-screenshot.swift /tmp/raw.png \
  www/src/assets/screenshots/01-today.png
```

Read each capture back before moving on — a permission dialog, a stray tap, or
the dev gear is obvious in the image and invisible in the exit code.

### 6. Verify every file

```sh
for f in www/src/assets/screenshots/*.png; do
  echo "$f"; sips -g pixelWidth -g pixelHeight -g hasAlpha "$f" | tail -3
done
```

Every file must read **1320**, **2868**, **no**. Anything else will be rejected.

### 7. Report

Tell the user the file paths, confirm the verified dimensions, and note that
`docs/appstore.md` covers the listing metadata. Screenshots are uploaded to App
Store Connect manually — no workflow does it.
