# App (`/src`)

The Dexter app is built with [Expo](https://docs.expo.dev/) (React Native) and
[Expo Router](https://docs.expo.dev/router/introduction/) for file-based
navigation. Targets **iOS**, **Android**, and **web** — and Mac, by way of the
iPad build running on Apple Silicon, not a Mac target of its own (see
[Mac Catalyst](#mac-catalyst-experimental--dex-85)). Commands live in
`AGENTS.md`; tests go in `__tests__/` next to source files, never under `app/`
(phantom routes).

This doc holds the conventions, gotchas, and rejected alternatives that apply to
**any** screen. What a particular screen or feature does is `docs/features.md`;
read `docs/design.md` before touching any style value.

## Navigation and shell

Routes live under `app/`: `(auth)/login` behind an auth boundary,
`(app)/(tabs)/` holding the five tabs (`today`, `ritual`, `week`, `settings`,
`search`), plus the `new-task` / `edit-task/[id]` modals and `oauth/consent`.

**Navigation is chosen by form factor, not by width (DEX-104).** Phones get
`NativeTabs` (platform tab bar); tablets and web get the JS `Tabs` with its bar
hidden inside `components/AppShell.tsx` — web because `NativeTabs` renders a
Radix tab bar that cannot be hidden (DEX-74), tablets because the rail reads
better than iPadOS's adaptive sidebar. `utils/deviceType.ts`'s `IS_TABLET` is a
module-scope **constant, not a hook**, deliberately: it selects a navigator, and
anything that could flip at runtime would swap the navigator under a running app
and reset every tab's state. It reads `Dimensions.get("screen")` (an iPad in
Split View is still an iPad).

`AppShell` owns the navigator **and** all the `Tabs.Screen` registrations so the
rule "every route stays registered regardless of which nav items are visible" is
one declaration. The chrome is `components/AppNav.tsx` (rail + dock, ported from
the legacy dexter-app); only web swaps between them (`useShowNavRail`) — a tablet
pins the rail at every width so its navigation never moves. Between 768 and 844dp
of window a tablet's large-screen layouts run against ~744dp of real content; if
that reads badly, subtract the rail's width inside `useIsLargeDevice`, not at its
~15 call sites. Destinations are `Link`s, not press handlers, so they render real
anchors on web; the active item carries `aria-current="page"`
(`accessibilityState.selected` maps to `aria-selected`, ignored outside tab-like
roles).

**No window-dependent value may touch a native tab trigger.** expo-router warns
that dynamically hiding tabs remounts the navigator and resets its state; Week's
trigger used to be gated on `useIsLargeDevice()` and survived only by a
portrait-lock argument that was never true of iPad. Now: a phone declares no
`week` trigger at all (with `useOnlyUserDefinedScreens`, the route doesn't resolve
there), everywhere else registers it unconditionally and `week/index.tsx` renders
an explanation below the breakpoint. Whether the nav *item* is offered is a
`largeScreenOnly` flag on `NAV_ITEMS`, filtered in one place. Keep that a width
predicate — an iPad mini in portrait genuinely can't render seven columns.

**Create-task entry points**: the phone tab bar's `NativeTabs.BottomAccessory`
(iOS 26+ — free, since `deploymentTarget` is 26.1) and the rail/dock's "+". Both
route through `utils/newTaskRoute.ts`, which reads the viewed day from
`hooks/useViewedDay.tsx` — a module-scoped store, not context, because the day
must be read **at press time**: opening the modal blurs the tab that publishes
it. Android phones have no create entry point (no accessory, no rail); Android
tablets get the rail's. **Since DEX-49 a running focus block takes the accessory
over entirely**, so an iOS phone has no create-task entry point for the length of
a block — deliberate, since a block is time spent not adding to the list, and the
button returns the moment it ends.

**The bottom accessory renders its children twice, at once.**
`react-native-screens` renders `ios.bottomAccessory('regular')` *and*
`ios.bottomAccessory('inline')` as two live children, wrapped in expo-router's
placement context. Two consequences, and the first is the trap: **every effect
there runs twice**, so nothing mounted in the accessory may write. (The second:
React context *does* reach it — an older comment in `useViewedDay.tsx` claimed
otherwise, and the module store there is justified by press-time reads, not by
context.) `TabBarAccessory` is therefore a dumb reader over `useFocusTimer`'s
module store, and the write that completes a block lives in `(app)/_layout.tsx`.

That store has a second caller for an unrelated reason: **`MoreMenu` renders
once per task card**, so reading the live block through `useLiveFocusBlock` there
put a query observer and two mutation observers on every row of a long list to
read one shared value. Reach for `useFocusTimer` from anything that renders per
row; `useLiveFocusBlock` is for the handful of surfaces that own the timer.

## Modal screens

- Web form sheets render through Expo Router's experimental modal stack, enabled
  by `EXPO_UNSTABLE_WEB_MODAL=1` — read by Expo CLI at Metro-resolver time, so it
  lives in the `start`/`web`/`export:web` scripts, not `app.json`. It is
  **bundle-wide**: every screen expo-router counts as a modal presentation
  renders as a centered dialog dismissible by backdrop click.
- **Every modal screen's contents must sit in one flex column —
  `components/ModalScreen.*`.** The stack's `.modalBody` is `display: flex` with
  no `flex-direction`, so it defaults to `row`; a screen returning a fragment
  renders empty apart from a stray ✕/✓. `ModalScreen` is a `flex: 1` View on web
  and a passthrough on native (a wrapper would break iOS's keyboard/content
  insetting under the form-sheet header).
- **Render `components/ModalLoadingScreen.tsx` from an async modal gate, never a
  bare `LoadingScreen`** (DEX-101) — the header buttons live in the form, so a
  bare loading gate leaves the modal with no ✕. On web there is no header slot at
  all; the in-tree `WebModalHeader` is the only header a web modal has.
- **A modal that resolves a record branches three ways — loading, errored, absent
  (DEX-100).** `isLoading ? <LoadingScreen /> : <Redirect />` reads "the query
  failed" as "the record was deleted", because no hook's loading flag survives an
  error (placeholder data is only served while pending). Branch: record → form
  (check the record **first** — a background refetch can fail after first load and
  must not blow away the form), `isLoading` → loading, `isError` →
  `ModalErrorScreen` (retry), else → `DismissModal`, which pops one-shot **from
  `useFocusEffect`** so a background-tab refetch can't pop the screen the user is
  looking at. **The rule is not yet universal:** `settings/lists/[id]` and
  `settings/habits/[id]` still carry the two-way bug; converting them needs
  `isError`/`refetch` on `useLists`/`useHabits` first. `new-task.tsx` still has a
  bare `router.back()` close — on a cold `/new-task` load ✕ is a dead `GO_BACK`;
  `useDismissModal("/")` is the fix, not yet done.
- **Create *in* the modal — route to `id: "new"` and let ✓ do the write.** A menu
  item that writes a row and then opens its editor leaves ✕ nothing to cancel
  (orphan row) and, pushed from `onSuccess`, can open a phantom modal for the
  wrong record when the action fires twice. Decide anything the write needs from
  the *saved* values, not the entry point.
- **`router.back()` is not a safe close** — several modals are pushed from outside
  their own stack (MoreMenu's template items). `settings/tasks/` is its own stack
  anchored on its `index` (`unstable_settings = { anchor: "index" }`); outside
  callers push `{ withAnchor: true }`. Pushing the list first at the call site is
  *not* enough — cold-navigation pushes coalesce. Prefer `back()` over
  `router.dismissTo(href)`: `dismissTo` *replaces* when it can't find its target
  and throws away the history under it.
- **A nested stack's root gets no back button on native unless the parent owns its
  header** (DEX-93): the native back item comes from the platform controller's own
  stack, and expo-router's parent-aware `canGoBack` only reaches custom header
  render functions. `settings/_layout.tsx` keeps the Tasks header for the nested
  stack; `tasks/_layout.tsx` hides its index's.
- **One close for every modal editor — `hooks/useDismissModal.ts`.** Its guard is
  **`router.canDismiss()`, not `canGoBack()`**: `canGoBack` is also true when the
  only "back" is the tab navigator jumping tabs, so the fallback would never fire
  and ✕ would land on another tab (DEX-93). `settings/lists/[id]`/`habits/[id]`
  stay flat on purpose — they are never pushed from outside, so a nested stack
  would only import the header problem.

## Web overlays

**Every web overlay goes through `components/WebOverlay.web.tsx` — never React
Native's `Modal`.** The cause is **inherited `pointer-events`**: while any Radix
dismissable layer is open (the modal stack renders through vaul, and so does
`TaskDrawerSheet`), `@radix-ui/react-dismissable-layer` sets
`pointer-events: none` on `document.body` and re-enables it on its own layer only
— anything outside still paints on top but silently swallows every click. Fixing
this one component at a time kept producing new instances (DEX-134).

`WebOverlay` portals into `document.body` (in-tree `position: fixed` resolves
against `.modal`'s `will-change: transform` containing block, which breaks
`getBoundingClientRect` anchoring) and re-declares `pointerEvents: "auto"`. It
stops propagation of **`pointerdown` only** — Radix reads an outside pointerdown
as a dismiss, and a body portal is outside by construction. **Do not extend that
to `mousedown` or `touchstart`**: react-native-web's responder system binds both
on the document, so stopping either makes every `Pressable` inside an overlay
dead — same symptom, different route, invisible to jsdom tests. There is no web
e2e harness; verify overlay-under-dialog clicks in a browser.
(`rn-emoji-keyboard`'s internal modal still has the defect in the list/habit
editors — third-party, unfixed.)

## Safe areas and keyboard

One convention across every scrolling tab screen: the screen's `SafeAreaView`
**omits the `bottom` edge** (Settings screens take
`utils/settingsSafeAreaEdges.ts`'s constants; two-pane mode drops `left` because
the sidebar absorbs it), so content renders behind the translucent tab bar —
which `minimizeBehavior="onScrollDown"` needs, and which lets pane borders reach
the screen edge. The standing obligation: each surface reserves `insets.bottom` in
its **own scrollable content**, never on the scroller's frame or a wrapper — frame
padding ends the viewport above the bar and cuts content off instead of letting it
pass under (DEX-75 → DEX-91).

The other half of making that bar minimize is **where the scroll view sits in the
view tree, and when** (DEX-136). UIKit resolves a tab screen's content scroll
view by walking only `subviews[0]` at each level from the screen root, and
`react-native-screens` runs the same walk **once**, on the screen's first frame,
to flip that scroller's `contentInsetAdjustmentBehavior` off React Native's
`never` default. Two obligations follow, and a screen that misses either gets no
minimize at all — silently, since nothing else about it looks wrong:

- **The vertical scroller must be first.** A header, or a horizontal scroller
  like `HabitTracker`, ahead of it ends the walk somewhere with no scroll view
  in it. Where the layout wants the header on top, give the wrapper
  `flexDirection: "column-reverse"` and list the children in reverse: Yoga lays
  a reversed column out bottom-up while React Native still mounts native
  subviews in JSX order, so the order changes and the pixels don't
  (`SmallScreenToday`, `TasksView`, `CalendarView`).
- **It must be there on the first frame.** An empty or loading state that
  *replaces* the scroller is usually exactly what the walk sees — Search always
  mounts idle, Today can open on a day with no tasks. Put those states inside
  the scroller (`ListEmptyComponent`, or a child of a `flexGrow: 1` content
  container) rather than in its place. This is the rule the Search tab's DEX-107
  note in `docs/features.md` is a special case of.

`zIndex` is not a way out of the first rule: Fabric implements it by reordering
the mounted subviews, which is the thing being fixed. The escape hatch is
`ScrollViewMarker` from `react-native-screens/experimental`, which names the
scroll view outright — but its native half compiles only when
`RNS_GAMMA_ENABLED=1` is set at `pod install`, and is an inert stub otherwise,
so it would have to be threaded through EAS *and* every local build.

Keyboard avoidance composes with that: screens with fields in a scroller set
`automaticallyAdjustKeyboardInsets` (iOS insets content; Android resizes the
window). **Do not** pair it with a reanimated wrapper padding the frame by
`keyboard.height` — both subtract the keyboard and frame padding never moves
content, so the field stays covered (the DEX-92 journal bug).

Exceptions, all deliberate: `settings/account.tsx` claims the bottom edge (no
scroller); `TaskDrawerSheet` presents over the tab bar and corrects the inherited
inset; and the Search tab frames itself with `react-native-screens/experimental`'s
`SafeAreaView` — both in `docs/features.md`.

## Theming

`utils/theme.ts` is the single source of truth for every style value. **What
tokens mean lives in `docs/design.md` — read it before touching a style.**
Plumbing:

- **`useTheme()`** composes palette + density and is the only way components read
  style values. Inject varying values inline; keep static *layout* in
  `StyleSheet.create` (its values are static, so anything theme- or
  tier-dependent must be inline).
- `providers/ThemeProvider.tsx` resolves `preferences.themeMode` / `lightTheme` /
  `darkTheme` via the pure `resolveTheme`. With no provider (root chrome,
  unauthenticated screens, tests) `useTheme` falls back to the OS scheme. On web
  the first paint has no reliable `prefers-color-scheme`, so
  `useResolvedColorScheme` renders light then resolves in a layout effect (before
  paint).
- **Navigation surfaces must be themed explicitly** — a bare `<Stack>` renders a
  light header in dark mode; layouts pass screens through
  `createListScreenOptions`/`createModalScreenOptions` (`utils/stackOptions.ts`),
  and the root Stack sets a themed `contentStyle` so pre-paint gaps match the
  scheme.
- **Density is a pointer tier, not a multiplier** — compact on web ≥768px only;
  see `docs/design.md`.

## Auth

Supabase magic-link email + Google OAuth (PKCE) via `hooks/useAuth.tsx`; the
singleton client lives in `utils/supabase.ts`. Guards live in the layouts
(`(app)`/`(auth)`/`index`). The login email carries both a link and a code
(`verifyOtp({ type: "email" })`); the demo account routes through
`verify-demo-otp` instead — `isDemoEmail` is duplicated from the Deno module (it
can't be imported) and must stay identical; see `docs/api-routes.md`. The callback
URL is `Linking.createURL("auth-callback")` and both forms must be in
`config.toml`'s `additional_redirect_urls` **and** the hosted project's allowlist.
`app/oauth/consent.tsx` (outside the `(app)` group, self-guarding) renders the
OAuth-server consent screen; an unauthenticated visitor's `authorization_id` is
stashed (`utils/oauthReturn.ts`) and replayed after sign-in.

## Error monitoring (Sentry)

`@sentry/react-native` via its Expo config plugin. Non-obvious parts:
`Sentry.wrap(RootLayout)` is plain composition, so it's React-Compiler-safe; the
exported `ErrorBoundary` can render when providers above it failed, so it relies
on `useTheme()`'s OS fallback; `QueryProvider` reports query/mutation failures
from cache-level `onError` handlers; source-map upload happens in native build
phases and needs the `SENTRY_AUTH_TOKEN` **EAS secret** (Release profiles only —
dev profiles set `SENTRY_DISABLE_AUTO_UPLOAD`). Triage with the `/triage-sentry`
skill.

**`SENTRY_ENABLED` in `app/_layout.tsx` is off in development**, and `debug`
follows that flag rather than `__DEV__`. Sentry's ingest domains are on
EasyPrivacy and most ad blockers' default lists, so on web the transport's `fetch`
is rejected before it leaves the tab, and `debug` printed the failure once per
envelope — every navigation, at `tracesSampleRate: 1.0`. Turning only `debug` off
would have hidden that while still filing developers' own exceptions against the
production issue stream. Flip the flag to `true` to exercise reporting locally;
leaving `debug: __DEV__` when disabled just narrates events being discarded, which
is why it is tied to the same constant.

## Data Layer

`api/` holds typed Supabase query modules; `hooks/` the React Query hooks;
`providers/QueryProvider.tsx` the query client. Freshness is three layers, no
interval polling (DEX-36):

- Shared 60s `staleTime` (`DEFAULT_STALE_TIME_MS`); device-backed hooks override
  it (AsyncStorage: `Infinity`; calendar sources: 10 min +
  `refetchOnMount: "always"`).
- **Focus refetch needs a native event source** — the browser's
  `visibilitychange` is free, but `QueryProvider` must tie
  `focusManager.setFocused` to `AppState` on native or foregrounding never
  refetches.
- `useRealtimeInvalidation` subscribes to `postgres_changes` and is
  **invalidation-only** — payloads are never written into the cache (unfilterable
  DELETEs, PK-only old records; see `docs/backend.md`). Bursts coalesce (~250ms);
  a channel rejoin invalidates every mapped key once, since Realtime does not
  replay missed events. **The per-date echo guard**: an autosave upsert echoes
  back as a realtime event, and refetching that date's row mid-mutation races the
  debounced editor — each notes/journals mutation is tagged with a per-date key,
  and invalidation skips only the date(s) currently mutating. Per-date, not
  per-table, because these mutations outlive their component and retry in the
  background — a stuck retry for one date must not suppress updates for another.

## Today is a subscription, not a clock read (DEX-161)

**Anything that renders "today" reads `hooks/useToday.ts`.** A
`Temporal.Now.plainDateISO()` in a `useState` initializer is frozen for the life
of the mount, which is why an app open before midnight kept yesterday until a
force-quit; one during render is correct only whenever something *else*
re-renders, and nothing does at midnight. The hook's snapshot re-reads the clock
but hands back the **same `PlainDate` until the day changes** — load-bearing, or
`usePublishViewedDay` re-registers its focus effect on every unrelated render and
momentarily clears the day the nav rail's "+" reads.

`useDayRollover()` (once, in `(app)/_layout.tsx`) is what re-renders subscribers
at the boundary: a timeout anchored on the next local midnight *and* an
`AppState` listener, since JS is frozen while suspended and the timer fires
however late on resume. Not an interval — the no-polling rule above still holds.

**Press-time and mutation code keeps reading `Temporal.Now` directly** (schedule
presets, form defaults, `useTasks`'s fetch window). Those run when the user acts,
so the live clock is strictly fresher than any subscribed value.

A screen holding a day in state **follows a rollover only when it was showing
the day that just ended** — a user who paged to next Tuesday meant it. All three
(Today, Week, Ritual) reconcile during render, next to their deep-link
adjustments, so the day never paints wrong for a frame.

## Platform-split components

The four-file pattern (`.types.ts` / `.native.tsx` / `.web.tsx` / a `.tsx`
re-exporting native so `tsc` — which doesn't do platform-extension resolution —
can resolve the import). Notable splits:

- `NoteEditor`: native wraps `react-native-enriched-markdown` (uncontrolled —
  `defaultValue` + `onChangeMarkdown` so React never fights the caret); web is
  **read-only** (upstream #392). Native module → dev-client rebuild.
- `SearchField`: two files only; the native half renders `null` and can't be
  unit-tested — device-only verification.
- `GlassIconButton`: liquid glass on iOS with plain-circle fallback; needs an
  explicit `size` because the native menu host requires a fixed-size trigger. Its
  `active` prop exists because the *default* tint differs by platform — omitting
  it drew the button two different colors. **`solid` forces the fallback circle
  on iOS, and any button under an animated opacity needs it**: the glass is a
  `UIVisualEffectView` sampling what is behind it and cannot do that through a
  non-opaque ancestor layer, so it washes out to nothing and leaves a bare glyph.
  That is every button inside a ritual step, which `SwipeablePage` fades in on
  each swipe. Invisible on web and Android, which draw that circle regardless.
- `utils/alert.ts`/`alert.web.ts` (DEX-102): `showAlert` is `Alert.alert` native /
  `window.alert` web (RN's `Alert` silently no-ops there). Reach for it instead of
  another `Platform.OS === "web"` branch; the browser dialog has no title slot, so
  the message must read without one. `ConfirmationModal` (via `useConfirmation`)
  remains the answer when the user must *choose*.

### Menus (`IconMenu` / `MoreMenu`)

`IconMenu` is `@expo/ui`'s `MenuView` on native, a custom overlay on web;
right-click is web's long-press (DEX-60), for `trigger="longPress"` menus only.
**`MoreMenu` is deliberately short: a menu row whose only job is to open a picker
is a detour, not a shortcut** (DEX-98) — everything a single tap can't finish
lives in the edit modal. The focus-block row (DEX-49) clears that bar only
because the length is a preference; making it ask "how long?" would put it back
under the rule. It is also **absent**, not disabled, while another task's block
runs — see `docs/features.md`. Its Stop *does* prompt, per the rule above that a
menu action writing immediately keeps its confirmation: the modal is hosted once
in `FocusTimerHost`, since `MoreMenu` renders per card and has nowhere to put one. The reason a picker sheet existed at all still stands:
neither platform's date picker can be opened imperatively (no ref, no
`isPresented`), so don't reach for "just focus the date field" without a native
module. Menu actions that write immediately keep their confirmation prompts; the
edit modal writes nothing until ✓ and applies the same rules silently.

**Every `@expo/ui` host sizes asynchronously, and a mis-sized one renders
*untappable*** — which is why `DayViewSwitcher`, `StatusButton`, `TaskCard` and
the ritual step control all pin theirs to exact pixels. `Host matchContents` is
the part to re-check on device after an `@expo/ui` bump. A native menu host also
sizes to its child's **intrinsic** height, so a flex-only child inside a scroller
collapses the control to ~2px — controls hosted in a scrolling surface need an
explicit `height`.

Menu styling: `iconColor` on an iOS action button needs `@expo/ui` ≥ 57.0.8 (below
that the system menu ignores `.foregroundColor`). The Android menu's light/dark
comes from `colorScheme`, fed from `useTheme().mode` — unset, the Compose menu
follows the *device* scheme, wrong whenever the in-app theme disagrees; `mode`
lives on the palette (not just `THEMES`) for exactly this.

### Native-module load-bearing versions

- **`expo-modules-core` ≥ 57.0.8**: SwiftUI mutates its hosted platform view
  asynchronously even after teardown; before the isolation-container fix (carried
  here as a patch until upstream), those leaked mutations corrupted Fabric
  rendering — cards ballooned, collapsed, or whole days rendered blank (DEX-28). A
  downgrade brings the corruption back.
- **A patch to a *precompiled* Expo module never reaches the binary** —
  `patch-package` edits source that precompiled linking never compiles, and
  nothing warns. Only packages shipping `prebuilds/*.tar.gz` are actually
  precompiled (in SDK 57: `expo-modules-core`, `expo-file-system`, `expo-font`);
  everything else builds from source, patches included. Set
  `ios.usePrecompiledModules: false` only when patching one of those — check for
  the tarball, not `spm.config.json`.
- **Patch filenames carry the installed version and it is load-bearing** — after
  any dependency bump, re-run `npx patch-package <name>` so the filename tracks
  it; a mismatch is a warning locally and a hard `npm ci` failure in CI.
- **`expo-alarm-kit` is a fork, not a patch** (`cvburgess/expo-alarm-kit`, pinned
  by git ref; DEX-158). A patch could make the timer's pause button optional but
  could not add a field to the metadata struct AlarmKit carries — that meant
  editing three function-local structs in someone else's package. Things to know
  before touching it:
  - **`build/` is committed and there is no `prepare` script.** `prepare` would
    make npm install the module's own devDependencies — Expo 54, RN 0.81 — into
    every `npm ci`, local and EAS, just to run `tsc`, and a failure there fails
    the whole install. The cost is that a stale `build/` ships silently, so the
    fork's CI rebuilds and diffs it. Change its source, commit the build.
  - **npm rewrites the `git+https://` spec to `git+ssh://` in the lockfile.**
    Harmless *only* while the fork is public: pacote fetches hosted GitHub repos
    over the codeload tarball and never invokes ssh. Making it private breaks CI
    and EAS with no obvious error.
  - Dropping the fork means restoring a patch, not just bumping a version.

## Build and tooling

- **EAS dev client**, not Expo Go (`npm run dev:simulator` / `dev:ios` /
  `dev:android`; profiles in `eas.json`, `appVersionSource: remote`). Native tabs,
  the share extension, alarms, and the note editor all require it. Store release
  is the manual Build and Submit workflow — see `docs/appstore.md`.
- **Expo's generated type files are gitignored, so local and CI type-checking
  differ.** `expo-env.d.ts` and `.expo/types/router.d.ts` are written by
  `expo start`/`expo export`. A *stale* router.d.ts fails `npm run typecheck` on a
  route that exists — start the dev server once before believing it. CI has
  neither file, so a type-aware lint rule can pass locally and fail there;
  `src/global.d.ts` carries `/// <reference types="expo/types" />` for exactly this
  (DEX-95) — don't remove it. To reproduce a CI type result, move both generated
  paths aside; one is not enough.
- **Applying `expo-doctor`'s version bumps means regenerating the lockfile
  (DEX-116).** `expo install --check` rewrites `package.json` only, and npm will
  not bump a package it has already locked as a peer — an SDK patch bump pinning
  an exact transitive dep dies on `ERESOLVE` forever. The fix is
  `rm -rf node_modules package-lock.json && npm install`; repairing the old lock
  does not work. The regen floats every caret/tilde range, so a stricter
  `typescript-eslint` or `@types/*` can turn lint/typecheck red in untouched files
  — re-run all four checks afterward, and re-run `npx patch-package` for each patch
  in the same pass (a patch whose fix landed upstream stops applying: a warning
  locally, a hard failure in `npm ci`).
- Env: `.env.local` with `EXPO_PUBLIC_SUPABASE_URL` /
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `EXPO_PUBLIC_SENTRY_DSN` (see
  `src/README.md`). Regenerate DB types with `npm run supabase:types`.
- Web renders as a SPA (`web.output: "single"`) so `AuthProvider` doesn't run under
  Node SSR. React Compiler is on (`experiments.reactCompiler`). iOS deployment
  target is 26.1 (accessory, glass, AlarmKit).
- App icons: iOS uses an Icon Composer `.icon` bundle (own light/dark/tinted
  variants); Android adaptive icon PNGs are rasterized from the same
  `assets/app.icon/Assets/Vector.svg` source of truth.

## Mac Catalyst (experimental — DEX-85)

Opt-in behind `EXPO_MAC_CATALYST=1` (no EAS profile sets it; with it unset the
prebuild config is byte-identical). Three files carry it: `app.config.ts` (the
only reader of the flag; drops `@bacons/apple-targets`, forces building-from-source
because neither Expo's nor RN's published binaries have a usable Catalyst slice),
`plugins/withMacCatalyst.ts` (device family, excludes `expo-alarm-kit`, empties the
App Group entitlement; **every Podfile edit asserts an exact match count** so a
template change fails loudly — expect to re-anchor on SDK upgrades), and
`macCatalystStubs/` + a Metro alias (the AlarmKit stub must report **success**, or
`useAlarmSync` answers the throw with a repeating alert). Build with `xcodebuild`
(`expo run:ios` has no `variant=` support); sanity-check `UIDeviceFamily` prints
`6`, not `2`. `IS_TABLET` covers Catalyst (idiom `mac`); `isAlarmSupported`
excludes it.

Four native patches exist for this target (the first two compile-time-guarded and
inert on iOS):

| Patch | Why |
|---|---|
| `react-native+0.86.2.patch` | `UISwitch` resolves to an AppKit checkbox under the Mac idiom; sets sliding style and makes `RCTSwitchSize()` measure the same style. |
| `@expo+ui+57.0.8.patch` | SwiftUI resolves `Menu` to an AppKit pull-down, replacing custom `IconMenu` labels. Upstream: expo/expo#48448. |
| `expo-calendar+57.0.1.patch` | **Not Catalyst-specific** — `EKCalendarItem.calendar` is `null_unspecified` and a force-unwrap traps the JS thread. Upstream: expo/expo#48445. |
| `react-native-audio-api+0.13.3.patch` | **Not Catalyst-specific** — `AUDIO_PARAM_MAX_QUEUED_EVENTS` 64→512: the automation queue silently drops events past the cap, so a default 3-breath Breathe run (76 events on a voice gain) lost its final inhale's release (DEX-187). Keep the constant in step with `BREATH_AUDIO_MAX_EVENTS_PER_PARAM`. |

Not implemented: menu bar, multi-window, and any distribution path.

**The Mac app on the App Store is not this target.** It is the ordinary iOS/iPad
binary with "Designed for iPad" enabled on Apple Silicon — no EAS profile sets
`EXPO_MAC_CATALYST=1`, so nothing built by CI has ever been a Catalyst build.
Shipping Catalyst instead would mean a separate binary and its own submission.
