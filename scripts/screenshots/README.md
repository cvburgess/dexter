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

**iPad ships landscape, iPhone portrait.** That split is the app's, not a
preference: the built `Info.plist` has a portrait-only
`UISupportedInterfaceOrientations`, while `UISupportedInterfaceOrientations~ipad`
carries both landscape orientations — rotate an iPhone simulator and the app
keeps rendering portrait. Apple accepts either orientation for both slots
(1320 × 2868 / 2868 × 1320 iPhone, 2064 × 2752 / 2752 × 2064 iPad). Landscape is
also simply the better iPad shot: at 1366pt wide all four Today panes fit and
the week grid shows six days, where portrait squeezes the notes pane to about
one character wide and clips the week at Thursday.

Two consequences worth knowing:

- **`simctl` ignores orientation.** It always captures the native *portrait*
  framebuffer, handing back a portrait canvas with the content turned 90°. So
  `capture.sh` gates on the native size and publishes the swapped one, and
  `flatten-screenshot.swift --rotate-ccw` straightens the image in the same
  CoreGraphics pass that strips the alpha. Rotating with `sips -r` first would
  re-add the alpha channel that pass exists to remove.
- **Rotating needs Accessibility permission.** There is no `simctl` verb for
  orientation — it lives only in the Simulator app's Device > Orientation menu —
  so `set-orientation.applescript` drives that menu. Grant the terminal running
  `capture.sh` access under System Settings > Privacy & Security > Accessibility,
  or the rotate step fails with a clear message.

**A stale build is the nastiest failure here, so the script checks for one.**
It rebuilds unless the installed app is a Release build (`main.jsbundle`
present, no `EXDevLauncher.bundle`) *and* no `.ts`/`.tsx` under `src/` is newer
than this device's build stamp.

Both halves are load-bearing. A dev-client build drops the dev-menu sheet over
the login screen, which at least fails loudly. A merely *old* Release build is
worse: it launches, logs in, and captures real screens — of the previous app. A
deep-link parameter added since that build is silently ignored, so the run reads
as an app bug rather than a stale binary. That is exactly what a partial
`--device all` run caused once, rebuilding one simulator and leaving the other
behind.

**The stamp is `~/.cache/dexter-screenshots/<udid>.built`, and it is compared
against instead of the installed bundle's own mtime for a reason.** Reinstalling
the same old build product refreshes that mtime — `launchApp: clearState` does
exactly that — so the installed bundle can look newer than the source while its
contents are weeks behind. Timestamps on installed files describe when they were
copied, not what is in them. The stamp only moves when a build actually
succeeds, so a failed build correctly stays stale.

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

**Time of day does not matter.** The Ritual tab picks morning vs evening from
the wall clock, but a deep link's `?mode=` wins over it — every ritual row in
`screens.tsv` pins `mode=am`, so an afternoon run still shoots the morning flow.

**`hideKeyboard` does not work on the login inputs** — they are the app's own
`TextInput`. `flows/login.yaml` taps static text to dismiss instead.

## Demo data

The account resets daily via `.github/workflows/reset-demo.yml` (12:00 UTC), so
the anchors in `screens.tsv` are demo-data strings from
`supabase/scripts/demoData.ts` and stay valid. If you hand-edit the account to
stage a shot, reconcile `demoData.ts` **before** the next reseed — and prefer
inserting rows over a full reseed, which resets the demo password.
