# App Store screenshots

```sh
DEMO_OTP=... scripts/screenshots/capture.sh --device all --build
```

Captures both listing sets against the production demo account, strips the alpha
channel, and refuses to finish if any file would be rejected. Output lands in
`www/src/assets/screenshots/{iphone,ipad}/`, which `www/_config.ts`'s
`site.add("/assets")` auto-publishes — one set powers the listing and the
marketing site.

Adding a screenshot is a row in `screens.tsv`, not a new flow file.
Uploading to App Store Connect is still manual; `docs/appstore.md` has the
listing metadata.

## Why it is built this way

**Only a Pro Max is an accepted iPhone size.** App Store Connect validates
against a fixed list of reference resolutions. iPhone Air (1260 × 2736) and
iPhone 17 Pro (1206 × 2622) are not on it, and a flawless capture from either is
still rejected. Apple downscales the 6.9" set for smaller devices, so the
optional 6.5" set is deliberately not maintained.

**`sips` cannot strip an alpha channel.** `xcrun simctl io … screenshot` always
emits RGBA, App Store Connect rejects that, and every `sips` PNG export re-adds
alpha. `scripts/flatten-screenshot.swift` redraws through CoreGraphics instead.

Both failures surface as the same vague "dimensions" error, which is why the
verify step at the end of `capture.sh` is a hard gate rather than a report.

**The build is Release, not the dev client.** Autolinking wraps every
expo-dev-client symbol in `#if EXPO_CONFIGURATION_DEBUG` — see
`DevLauncherModule`, `DevMenuModule`, `DevMenuPreferences`, and the
`expo-dev-launcher` react delegate handler in
`src/ios/Pods/Target Support Files/Pods-Dexter/ExpoModulesProvider.swift`. A
Release build does not define that flag, so the onboarding modal, the dev-menu
sheet that used to cover the login screen, and the floating dev-tools gear that
sat over the header button in every shot cannot exist. The previous procedure
needed three percentage-coordinate taps to clear those; none of them transferred
to iPad, which is part of why the iPad set never got made.

**Navigation is by deep link, not by tapping.** `src/utils/todayRoute.ts`,
`ritualRoute.ts`, and `newTaskRoute.ts` define the contract. A coordinate tap
tuned for a 6.9" phone lands nowhere on a 13" iPad, and the `DayViewSwitcher`'s
contents have already moved once — Journal left the Today tab in DEX-105 and the
old procedure was never updated.

## Gotchas

**Maestro text selectors are regular expressions.** `assertVisible: "+ New Task"`
compiles to `textRegex=+ New Task` — a dangling `+` quantifier that can never
match. Prefer `id:` selectors (the app carries 207 `testID`s); if a `text:`
anchor is unavoidable, escape any `+ ( ) ? . * [ ]`.

**Maestro's loudest log lines are harmless.** Every run opens with a burst of
`[Failed] Perform XCUITest driver status check … ConnectException: Failed to
connect to /127.0.0.1:7001`, logged at INFO. That is Maestro reinstalling its
XCUITest runner and polling until it answers; `[Done]` follows a few seconds
later. Only worry if `[Done]` never arrives.

**On failure, look at the screenshot before the log.** Maestro saves the actual
failing screen to `~/.maestro/tests/<latest>/screenshot-❌-*.png`; `capture.sh`
prints the path.

**A bare `dexter://today` is not a navigation.** `parseDayLink` returns null when
neither `date` nor `mode` is present, so the link reads as an ordinary tab press
and will not close a backlog drawer the previous shot left open. Every Today row
in `screens.tsv` carries an explicit `mode=` and a distinct `n=` nonce.

**Ritual screenshots must be captured before noon.** The tab picks morning vs
evening from the wall clock (`modeForHour`), and `simctl status_bar` fakes only
the *displayed* time, not `Date.now()`. `capture.sh` refuses rather than silently
shooting the evening flow.

**`hideKeyboard` does not work on the login inputs** — they are the app's own
`TextInput`. `flows/login.yaml` taps static text to dismiss instead.

## Demo data

The account resets daily via `.github/workflows/reset-demo.yml` (12:00 UTC), so
the anchors in `screens.tsv` are demo-data strings from
`supabase/scripts/demoData.ts` and stay valid. If you hand-edit the account to
stage a shot, reconcile `demoData.ts` **before** the next reseed — and prefer
inserting rows over a full reseed, which resets the demo password.
