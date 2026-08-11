# App (`/src`)

The Dexter app is built with [Expo](https://docs.expo.dev/) (React Native) and
[Expo Router](https://docs.expo.dev/router/introduction/) for file-based
navigation. Targets **iOS**, **Android**, and **web**. Commands live in
`AGENTS.md`; tests go in `__tests__/` next to source files, never under `app/`
(phantom routes).

This doc records the conventions, gotchas, and rejected alternatives that the
code cannot say for itself. Read the section for the area you're touching; read
`docs/design.md` before touching any style value.

## Navigation and shell

Routes live under `app/`: `(auth)/login` behind an auth boundary,
`(app)/(tabs)/` holding the five tabs (`today`, `ritual`, `week`, `settings`,
`search`), plus the `new-task` / `edit-task/[id]` modals and `oauth/consent`.
Read the route files themselves for what each screen does.

**Navigation is chosen by form factor, not by width (DEX-104).** Phones get
`NativeTabs` (platform tab bar); tablets and web get the JS `Tabs` with its bar
hidden inside `components/AppShell.tsx` — web because `NativeTabs` renders a
Radix tab bar that cannot be hidden (DEX-74), tablets because the rail reads
better than iPadOS's adaptive sidebar. `utils/deviceType.ts`'s `IS_TABLET` is a
module-scope **constant, not a hook**, deliberately: it selects a navigator,
and anything that could flip at runtime would swap the navigator under a
running app and reset every tab's state. It reads `Dimensions.get("screen")`
(an iPad in Split View is still an iPad).

`AppShell` owns the navigator **and** all the `Tabs.Screen` registrations so
the rule "every route stays registered regardless of which nav items are
visible" is one declaration. The chrome is `components/AppNav.tsx` (rail +
dock, ported from the legacy dexter-app); only web swaps between them
(`useShowNavRail`) — a tablet pins the rail at every width so its navigation
never moves. Between 768 and 844dp of window a tablet's large-screen layouts
run against ~744dp of real content; if that reads badly, subtract the rail's
width inside `useIsLargeDevice`, not at its ~15 call sites. Destinations are
`Link`s, not press handlers, so they render real anchors on web; the active
item carries `aria-current="page"` (`accessibilityState.selected` maps to
`aria-selected`, ignored outside tab-like roles).

**No window-dependent value may touch a native tab trigger.** expo-router
warns that dynamically hiding tabs remounts the navigator and resets its
state; Week's trigger used to be gated on `useIsLargeDevice()` and survived
only by a portrait-lock argument that was never true of iPad. Now: a phone
declares no `week` trigger at all (with `useOnlyUserDefinedScreens`, the route
doesn't resolve there), everywhere else registers it unconditionally and
`week/index.tsx` renders an explanation below the breakpoint. Whether the nav
*item* is offered is a `largeScreenOnly` flag on `NAV_ITEMS`, filtered in one
place. Keep that a width predicate — an iPad mini in portrait genuinely can't
render seven columns.

**Create-task entry points**: the phone tab bar's `NativeTabs.BottomAccessory`
(iOS 26+ — free, since `deploymentTarget` is 26.1) and the rail/dock's "+".
Both route through `utils/newTaskRoute.ts`, which reads the viewed day from
`hooks/useViewedDay.tsx` — a module-scoped store, not context, because the
accessory renders outside the app's provider tree; the day must be read at
press time, since opening the modal blurs the tab. Android phones have no
create entry point (no accessory, no rail); Android tablets get the rail's.

## Modal screens

- Web form sheets render through Expo Router's experimental modal stack,
  enabled by `EXPO_UNSTABLE_WEB_MODAL=1` — read by Expo CLI at Metro-resolver
  time, so it lives in the `start`/`web`/`export:web` scripts, not `app.json`.
  It is **bundle-wide**: every screen expo-router counts as a modal
  presentation renders as a centered dialog dismissible by backdrop click.
- **Every modal screen's contents must sit in one flex column —
  `components/ModalScreen.*`.** The stack's `.modalBody` is `display: flex`
  with no `flex-direction`, so it defaults to `row`; a screen returning a
  fragment renders empty apart from a stray ✕/✓. `ModalScreen` is a `flex: 1`
  View on web and a passthrough on native (a wrapper would break iOS's
  keyboard/content insetting under the form-sheet header).
- **Render `components/ModalLoadingScreen.tsx` from an async modal gate, never
  a bare `LoadingScreen`** (DEX-101) — the header buttons live in the form, so
  a bare loading gate leaves the modal with no ✕. On web there is no header
  slot at all; the in-tree `WebModalHeader` is the only header a web modal has.
- **A modal that resolves a record branches three ways — loading, errored,
  absent (DEX-100).** `isLoading ? <LoadingScreen /> : <Redirect />` reads "the
  query failed" as "the record was deleted", because no hook's loading flag
  survives an error (placeholder data is only served while pending). Branch:
  record → form (check the record **first** — a background refetch can fail
  after first load and must not blow away the form), `isLoading` → loading,
  `isError` → `ModalErrorScreen` (retry), else → `DismissModal`, which pops
  one-shot **from `useFocusEffect`** so a background-tab refetch can't pop the
  screen the user is looking at. **The rule is not yet universal:**
  `settings/lists/[id]` and `settings/habits/[id]` still carry the two-way
  bug; converting them needs `isError`/`refetch` on `useLists`/`useHabits`
  first. `new-task.tsx` still has a bare `router.back()` close — on a cold
  `/new-task` load ✕ is a dead `GO_BACK`; `useDismissModal("/")` is the fix,
  not yet done.
- **Create *in* the modal — route to `id: "new"` and let ✓ do the write.** A
  menu item that writes a row and then opens its editor leaves ✕ nothing to
  cancel (orphan row) and, pushed from `onSuccess`, can open a phantom modal
  for the wrong record when the action fires twice. Decide anything the write
  needs from the *saved* values, not the entry point.
- **`router.back()` is not a safe close** — several modals are pushed from
  outside their own stack (MoreMenu's template items). `settings/tasks/` is
  its own stack anchored on its `index` (`unstable_settings = { anchor:
  "index" }`); outside callers push `{ withAnchor: true }`. Pushing the list
  first at the call site is *not* enough — cold-navigation pushes coalesce.
  Prefer `back()` over `router.dismissTo(href)`: `dismissTo` *replaces* when it
  can't find its target and throws away the history under it.
- **A nested stack's root gets no back button on native unless the parent owns
  its header** (DEX-93): the native back item comes from the platform
  controller's own stack, and expo-router's parent-aware `canGoBack` only
  reaches custom header render functions. `settings/_layout.tsx` keeps the
  Tasks header for the nested stack; `tasks/_layout.tsx` hides its index's.
- **One close for every modal editor — `hooks/useDismissModal.ts`.** Its guard
  is **`router.canDismiss()`, not `canGoBack()`**: `canGoBack` is also true
  when the only "back" is the tab navigator jumping tabs, so the fallback
  would never fire and ✕ would land on another tab (DEX-93).
  `settings/lists/[id]`/`habits/[id]` stay flat on purpose — they are never
  pushed from outside, so a nested stack would only import the header problem.

## Web overlays

**Every web overlay goes through `components/WebOverlay.web.tsx` — never React
Native's `Modal`.** The cause is **inherited `pointer-events`**: while any
Radix dismissable layer is open (the modal stack renders through vaul, and so
does `TaskDrawerSheet`), `@radix-ui/react-dismissable-layer` sets
`pointer-events: none` on `document.body` and re-enables it on its own layer
only — anything outside still paints on top but silently swallows every click.
Fixing this one component at a time kept producing new instances (DEX-134).

`WebOverlay` portals into `document.body` (in-tree `position: fixed` resolves
against `.modal`'s `will-change: transform` containing block, which breaks
`getBoundingClientRect` anchoring) and re-declares `pointerEvents: "auto"`. It
stops propagation of **`pointerdown` only** — Radix reads an outside
pointerdown as a dismiss, and a body portal is outside by construction. **Do
not extend that to `mousedown` or `touchstart`**: react-native-web's responder
system binds both on the document, so stopping either makes every `Pressable`
inside an overlay dead — same symptom, different route, invisible to jsdom
tests. There is no web e2e harness; verify overlay-under-dialog clicks in a
browser. (`rn-emoji-keyboard`'s internal modal still has the defect in the
list/habit editors — third-party, unfixed.)

## Today tab

The route is a thin selector over `SmallScreenToday`/`LargeScreenToday`,
keeping only the shared state: day, preferences, and the backlog-attention
signal. `hooks/useTasks.tsx` fetches once under the canonical `["tasks"]`
query — every incomplete task plus anything scheduled in the last
`RECENT_TASK_WINDOW_DAYS` (30) — and every view slices that cached array
client-side (`utils/taskFilters.ts`), so paging days is fetch-free (DEX-57).
The 30-day window is a known limitation: older days show their incomplete
tasks but not their closed-out ones.

### Safe areas and keyboard

One convention across every scrolling tab screen: the screen's `SafeAreaView`
**omits the `bottom` edge** (Settings screens take
`utils/settingsSafeAreaEdges.ts`'s constants; two-pane mode drops `left`
because the sidebar absorbs it), so content renders behind the translucent tab
bar — which `minimizeBehavior="onScrollDown"` needs, and which lets pane
borders reach the screen edge. The standing obligation: each surface reserves
`insets.bottom` in its **own scrollable content**, never on the scroller's
frame or a wrapper — frame padding ends the viewport above the bar and cuts
content off instead of letting it pass under (DEX-75 → DEX-91).

Keyboard avoidance composes with that: screens with fields in a scroller set
`automaticallyAdjustKeyboardInsets` (iOS insets content; Android resizes the
window). **Do not** pair it with a reanimated wrapper padding the frame by
`keyboard.height` — both subtract the keyboard and frame padding never moves
content, so the field stays covered (the DEX-92 journal bug).

Exceptions, all deliberate: `settings/account.tsx` claims the bottom edge (no
scroller). `TaskDrawerSheet` presents *over* the tab bar, so it corrects the
inherited inset with a `SafeAreaInsetsContext.Provider` `bottom: 0`
(`testUtils/renderWithBottomInset.tsx` drives tests through the same
mechanism). And `search/index.tsx` frames itself with
**`react-native-screens/experimental`'s `SafeAreaView`** (DEX-107):
`Stack.SearchBar` forces the header translucent, react-native-screens lays the
body under the navigation bar and its one automatic compensation walks a
first-child chain once at mount — when the screen shows its idle state, not
the list — while the context's per-tab top inset is only the status bar. The
screens `SafeAreaView` reads insets from `RNSScreenView`, which includes the
bar and re-dispatches as UIKit hides/shows it (visible on iPad, where the
search field stays in the header). That entry point warns its symbols may
break without a major version — **re-check the Search tab on an iPad after any
`react-native-screens` bump**, patch releases included.

### Paging and panes

`components/SwipeablePage.tsx` (small screens) pages days with a pan gesture
and an intro fade/slide on a keyed remount — deliberately *not* an `entering`
layout animation, which on the new architecture intermittently leaves the
subtree blank or mis-measured. It is shared with the Ritual tab (prop is
`pageKey`, not `dateKey`). Its `canNext`/`canPrev` exist because `onEnd` does
not reset `translateX` on a commit (the host's key change remounts at zero;
resetting first is what flashed the old day back) — so a bounded pager must
decline the swipe *inside* the component or the content parks where the finger
left it.

Large screens: Tasks is always visible at a fixed `TASKS_PANE_WIDTH` — it does
**not** flex, so a `TaskCard` is the same shape at every window size and the
other panes absorb the width (DEX-111). Pane visibility persists per device
via `hooks/useTodayPanes.ts` (AsyncStorage, not the synced `preferences` row —
a per-device layout choice); `readPanes` rebuilds the stored value key by key
so removed panes' keys drop out. Notes and Calendar remount on date change
(both seed uncontrolled state once per mount). The drawer toggle button
carries the overdue/left-behind **attention dot**
(`utils/taskFilters.ts`'s `backlogAttentionFilter` — Overdue first, else Left
Behind, as of the real today); the small-screen home for the dot is the
`DayViewSwitcher` trigger. Opening the drawer from those buttons pre-applies
that filter; on large screens the header toggle resets filter+search when
*opening* — load-bearing, or a `?mode=backlog` deep link's Unscheduled filter
survives into the header's "Backlog" action and shows a slice of what it
promises.

### The task drawer

`components/TaskDrawer.tsx` (DEX-33) derives its scope from the canonical
`["tasks"]` cache (`selectBacklogTasks`), all filtering/grouping/search
client-side. Its rows' "+" schedules through `useScheduleChange` (alarm
prompt included). It renders a flattened `{type: "header"|"task"}` FlashList
so rows recycle — each row carries `@expo/ui` native menu hosts, expensive in
bulk. FlashList v2 is JS-only, which is exactly why the drawer can virtualize
while `TasksView`'s un-virtualized `ScrollView` cannot (a *native* recycler's
off-viewport churn aggravates the hosts' async sizing, expo/expo#42576). The
app deliberately runs `@shopify/flash-list` newer than the SDK pin, listed in
`package.json`'s `expo.install.exclude` (DEX-116) so `expo install --check`
stops proposing the downgrade.

Two things are load-bearing when hosting the drawer in the small-screen sheet
(`TaskDrawerSheet`, `@expo/ui` bottom sheet): the Filter/Group control inners
need an **explicit `height`** — a native menu host sizes to its child's
intrinsic height, and a flex-only child inside a scroller collapses the
control to ~2px; and the drawer root + FlashList both need `flex: 1` or the
list lays out at full content height and overflows instead of scrolling. The
sheet is imperative (`present(filter?)` — `BottomSheetModal` has no controlled
visible prop) and defers rendering the drawer until first open.

### Calendar and notes

`components/CalendarView.tsx` is a themed timeline bounded by the user's
start/end hours; `utils/calendarLayout.ts` clamps and packs overlapping
events; times are hand-formatted (`utils/formatPlainTime.ts` — Hermes ships a
partial `Intl`). The source is the platform-split `hooks/useCalendarEvents.*`
(native: `expo-calendar` + device-local `useEnabledDeviceCalendars`; web:
`.ics` feeds through the `ics-proxy` function, parsed by `utils/icsEvents.ts`),
normalized to one `TCalendarEvent`. `notConfigured` is computed in both
platform files from what they already know — no extra permission prompt. On
today the timeline auto-scrolls once on first layout
(`scrollOffsetForTarget`), covered for both "view loads" and "day changed" by
the per-day remount.

`components/NotesView.tsx` autosaves the day's markdown debounced; a day with
no row offers template/blank (both write a row, so the choice persists —
`useNotes` exposes `exists` and never auto-seeds). `components/JournalView.tsx`
(Ritual tab only since DEX-105) autosaves `journals.prompts` wholesale;
responses are plain text; both rituals edit the same per-date entry.

## Week tab

Seven Monday-first columns (DEX-96), each reusing `components/DayTaskList.tsx`
(extracted so the repeat-aware delete confirmation isn't re-derived). Labeled
from ISO `weekOfYear`/**`yearOfWeek`**, not `year` — a week can belong to the
neighbouring calendar year, which the legacy app got wrong; math lives in
`utils/weekStartEnd.ts`.

The columns live in a horizontal **`DraxScrollView`** (see drag-to-schedule:
a plain `ScrollView` registers no scroll offset with drax, so after sideways
scrolling every drop would land on the wrong day). Columns are deliberately
read-only chrome — no per-column "+", `emptyMessage={null}`, no create nudge
(seven copies of anything read as noise) — and run **flush**: all horizontal
spacing comes from the row's `gap`, which the today-anchor also derives its
column pitch from, so the two must move together (DEX-115; see
`docs/design.md`, "Who owns spacing"). The docked backlog stays outside the
scroller; its drawer is uncontrolled here on purpose — the controlled filter,
dot, and deep-link seeding are Today's contract, and reusing `useTodayPanes`
would open the backlog on both tabs at once. Known cost: with habits on,
seven `HabitTracker`s mount with their own queries; a range query is the fix
if it ever shows.

## Ritual tab

A guided walk through the start/end of a day (DEX-127). The route owns one
`TRitualState` (`{date, mode, step, direction}` plus one boolean per optional
step) and branches on `useIsLargeDevice()`.

**Every rule lives in `utils/ritualSteps.ts`, and nothing in it is React** —
step lists, the noon boundary, and all transitions are pure functions.
Contracts that are load-bearing:

- Transitions return **the same object** for a no-op (either end of the list,
  the value already on screen) so a declined swipe doesn't re-render and
  restart the intro animation.
- **The step list is derived; state carries the input (booleans), not the
  output (an array).** `stepsFor(state)` picks a precomputed list off the
  enabled flags — precomputed because both switchers map the result every
  render and fresh arrays would defeat identity comparisons downstream.
  `state.step` indexes a list that can shrink, so it may only be produced by a
  transition in that module — never `{ ...state, step: n }` at a call site.
- **The `withXEnabled` transitions move the user by step *id*, not index** — a
  clamp would silently move someone from Calendar to Backlog when an earlier
  step is removed. Preserving the id also keeps `ritualPageKey` unchanged so
  `SwipeablePage` doesn't remount for a preference flipped in another tab.
  (`usePreferences` serves defaults until the row loads, so a cold launch
  corrects a round trip later — the correction has to be unremarkable, and it
  runs in both directions since journal/horoscope default on but calendar
  defaults off.)
- The "unchanged" guard stays on each exported transition because
  `ritual/index.tsx` compares each flag against preferences **during render**
  and sets state on disagreement — a transition that returned a state without
  updating its flag would spin the render loop forever.

The swipe pages **steps**, runs at every width (unlike Today, where large
screens page by arrows — a ritual is a sequence you move through, so the
gesture means something), and is suspended while a step reports editing.
`components/RitualStepView.tsx` is the seam: it branches on `step.id` and
unbuilt steps fall through to a placeholder, which is what lets sub-issues
fill steps in without touching the flow. The step's `onEditingChange` must be
passed **unwrapped** (a `useState` setter, never an inline arrow) — a
downstream cleanup depends on its identity, and a fresh function per render
clears the editing flag on focus. The step control mirrors Today's split
(menu on small screens, segments on large); on iOS the segments are a real
SwiftUI segmented `Picker` for liquid glass. **`Host matchContents` is the
part to re-check on device after an `@expo/ui` bump** — these hosts size
asynchronously, and a mis-sized one renders *untappable*, which is why
`DayViewSwitcher`, `StatusButton` and `TaskCard` pin theirs to exact pixels.
The drawn `SegmentedControl` (Android/web) needs `stretch={false}` in the
header's actions row, which has no width of its own — `flex: 1` segments
would divide nothing and collapse.

### Horoscope step (DEX-128)

Read-only client of `public.horoscopes` (`["horoscopes", sunSign, date]`),
deliberately not realtime (rows change once a day). The panel's colors and
frame are `docs/design.md`'s Sentiment section. App-side gotchas:

- `components/StarField.tsx` is **seeded, not random** (a sky must not
  reshuffle per render); stars deal into four layers with one shared opacity
  animation each (a shared value per star would drive a worklet per frame),
  with co-prime periods so they never re-align into one pulse. Star count is
  the cheap dial, layer count is not. The panel carries no `overflow: hidden`
  — clipping to a radius makes it an offscreen-rendered layer re-composited
  every frame a child animates.
- The audio (`hooks/useHoroscopeAudio.ts`) is built on `createAudioPlayer`,
  **not** the `useAudioPlayer` hook — the hook releases its player at unmount,
  which cuts audio dead with no window to fade; owning the player lets cleanup
  ride the volume down and then release, at the price that every exit path
  must end in `remove()`. `MAX_VOLUME` is linear amplitude against
  logarithmic hearing (0.5 is only −6dB — reported as "no change"). **On iOS
  browsers none of the volume work happens** — Apple reserves
  `HTMLMediaElement.volume` for the hardware buttons, so mobile-web tracks
  play at device volume and cut instead of fading; that's this, not the
  arithmetic. `expo-audio`'s config plugin is deliberately not installed (it
  only adds microphone permissions; this is playback-only).

### Calendar step (DEX-140)

Three `HeroLines` over the unchanged `CalendarView`. The arithmetic
(`utils/calendarStats.ts`, React-free) has three decisions worth keeping:
**planned time is the union of event spans, not the sum** (double-bookings
must not report thirty-hour days) and it **clamps before it merges** (an event
running in from yesterday contributes only its in-window part); the window is
the user's own configured hours, derived once (`calendarWindow`) so the number
can't disagree with the grid drawn under it; and **`layoutEvents` is
deliberately not reused** — it floors heights and inflates zero-length events,
drawing decisions that would be lies in a total. The step checks `isLoading`
**before** `notConfigured` — an unresolved read looks exactly like an
unconfigured one, and testing the source first flashes the setup prompt at
configured users on every cold open.

### Backlog step (DEX-141)

Three `HeroLines` over the Today drawer's `TaskDrawer` (search field hidden —
the one divergence from "same controls as today"). Load-bearing:

- **Counts anchor to today while the scope is the ritual's day** —
  `TaskDrawer` filters against today whichever day is shown, and a hero that
  disagreed with the list under it is worse than none. Both read the one
  `useTasks()` query, so clearing a task drops it from count and list in the
  same render. `backlogCounts` is built from `filterTasks(...).length` so a
  figure can never drift from the preset it labels; buckets overlap on
  purpose.
- **The filter follows the reader down the buckets, and only emptiness moves
  it.** `defaultBacklogFilter` picks the opening preset; `nextBacklogFilter`
  advances only when the current bucket empties, and the advance is **written
  back to state, not merely derived** — left derived, refilling the emptied
  bucket (un-complete, another device) would yank the list off whatever the
  reader moved on to. Set-state-during-render; it can't loop because an
  advance always lands on a non-empty bucket.
- The drawer half is a separate `BacklogList` component so its lazy state
  initializer never sees `useTasks`' empty placeholder — the same latch inside
  the step would fight two `react-hooks` lint rules that are both right. The
  step checks `isLoading` first or the all-clear hero congratulates a cold
  cache.

`components/HeroLines.tsx` is shared by both reporting steps: right-aligned
figures, left-aligned words, the figure column **measured** (widest raises a
`minWidth`, converges in one pass, monotonic so a shrinking figure never
re-flows the hero under the reader), each row one accessibility node carrying
the whole phrase. Stage timing lives in `useHeroReveal`/`useStageOpacity`;
the reveal is opacity-only — `SwipeablePage`'s intro already slides, and two
axes compound into a diagonal drift.

### Summary step (DEX-144)

The last step of **both** rituals (id `summary`, so it doesn't drift from the
label): habits/events/tasks counted through the same `HeroLines`, then "You got
this", then a button into `todayRoute({ date, mode: "tasks" })`. Load-bearing:

- **A morning task-list step was built here first and removed.** `DayTaskList`
  dropped into the step worked and cost almost nothing — but it copied a
  surface it could not replace, leaving two lists of the same day a swipe
  apart, where the ritual is a sequence you walk once and the day's list is
  what you return to all day. Reach for this history before re-proposing it.
- **The link carries the ritual's date, and needs its `n` nonce** for the same
  reason the Search tab's does: cross-tab navigation reuses the mounted Today
  screen and only swaps its params, so two presses carrying one date would be
  indistinguishable and the second would switch tabs and do nothing.
- **A line exists per feature the reader has, not per non-zero count.** A zero
  is a reading — it is why the button is there — but a calendar line for
  someone with no calendar is noise, so `enableHabits`/`enableCalendar` decide
  which lines exist and the counts only decide what they say. All three figures
  take `colors.primary` rather than the sentiment colors of the two reporting
  steps: this summarizes a day the reader has just finished planning, and none
  of its numbers is bad news.
- **The close is staged at `heroLines.length`, not `BODY_STAGE`.** That
  constant means "after all three hero lines" and is right for the two steps
  that always draw three; this one draws as few as one, and waiting for stage 3
  there would leave the button missing for most of a 3.6s sequence.
- An entirely empty day replaces the figures with one line
  (`summary-step-blank`) and keeps the button. `isLoading` is checked first or
  a cold cache tells someone with a full morning they have nothing on.

## Drag-to-schedule (DEX-77)

Large screens only (a phone's backlog is a native sheet a drag can't cross),
and never the only path — the row "+" and the Schedule submenu remain for
keyboard and screen readers. Library is `react-native-drax` (pure JS,
OTA-safe). `useDragSchedule()` returns `null` outside the provider and both
ends degrade to plain views, which is what keeps `DraxView` off small screens
without threading an enable prop.

- **Drax caches a view's props in its registry** at registration, refreshing
  only when a *capability* prop changes, and dispatches off that snapshot. So
  drop handlers must be identity-stable closures reading refs (`useCallback`
  keyed on the date is *not* a fix — a new identity is what the registry
  declines to pick up), and the drag **payload is a task id** resolved at drop
  time, never the task object, which would freeze stale.
- **The drop target is the whole day column**, which is what makes an empty
  day droppable given `emptyMessage={null}`.
- **Activation is by direction, not time** (`utils/dragActivation.ts`): a card
  sits under a vertical list scroll and a long-press context menu, so
  `longPressDelay: 0` + activate on sideways travel + fail on vertical. Every
  meaningful drop is sideways. A timed hold was tried twice and **cannot
  work**: `activateAfterLongPress` activates regardless of movement, so below
  the menu's ~500ms it silently cancels the menu and above it loses the drag —
  presenting as intermittent. The per-axis
  `dragActivationOffsetX`/`dragActivationFailOffsetY` props come from
  `patches/react-native-drax+1.1.0.patch`, which touches `src/`,
  `lib/typescript/` and `lib/module/` so every entry point agrees.
- **The hover preview is a static shell** (`TaskCardPreview`) — drax's default
  re-renders the dragged children into its overlay, which would mount a second
  set of async-sizing `@expo/ui` hosts that report 0 on native. It needs
  `alignSelf: "flex-start"` and an explicit width; drax's wrapper shrink-wraps
  and a `stretch` child collapses to zero on device.

`hooks/useScheduleChange.ts` is the one path `scheduledFor` changes through —
extracting it fixed the backlog "+" moving a task off its alarm's day and
leaving the alarm behind.

## Search (DEX-47)

Search does **not** filter the client task cache (30-day window — it would
silently miss older completed tasks); `hooks/useSearch.tsx` calls the
`search_entries` Postgres function (see `docs/backend.md` for the matching
strategy and `SECURITY INVOKER` reasoning). The input is the platform-split
`components/SearchField.*`: native is `Stack.SearchBar` (renders `null`,
appends itself to navigation options; **uncontrolled** — `value` is ignored;
`onChangeText` hands back a `NativeSyntheticEvent`, unwrapped so both halves
share one string contract), web is an in-body `TextInput` because
react-native-screens implements the header bar on iOS/Android only. The query
debounces through `useDebouncedValue` — deliberately a timer and not
`useDeferredValue`, which is a rendering-priority hint, not a throttle: when
the deferred render is cheap every keystroke still reaches the server.
Results group into sections (substring matching has no relevance score to
interleave by); `utils/searchHighlight.ts` collapses whitespace *before*
matching so offsets index the rendered string, and falls back to the head of
the text — `ilike` case-folds by collation while the client uses
`toLowerCase()`, and they disagree on some Unicode.

### Deep links

The contract lives in three modules: `utils/routeParams.ts` (shared
primitives), `utils/todayRoute.ts` / `utils/ritualRoute.ts` (each owns **both
directions** for its tab so builder and parser can't drift), and
`utils/searchRoute.ts` (which tab a result goes to; the split avoids an import
cycle). Malformed dates parse to null and fall back to today — these are web
URLs, so a hand-edited value is a real input. Two results deliberately have no
route (`canOpenSearchResult`): a completed task with no scheduled date (the
backlog can never show it) and a journal entry while the journal is disabled.

Plumbing that is easy to undo by accident:

- **`openPane`, not `togglePane`** — a toggle guarded at the call site puts
  `panes` in the effect deps, so every later toggle re-runs the effect and
  re-opens what the user just closed.
- **The state syncs are render-phase adjustments, not effects** (the
  `react-hooks/set-state-in-effect` pattern): a `useState` initializer (right
  when arriving with the link already set) paired with an applied-value guard
  (re-applies later changes without stomping the user's own navigation).
  Dropping either half breaks a different case.
- **Guards key on `link.id`, not contents.** Cross-tab navigation does not
  remount the screen (a `push` downgrades to `JUMP_TO`), so a value-comparing
  guard can't tell "already applied" from "applied, user navigated away, asked
  again". `searchResultRoute` stamps each tap with an incrementing nonce
  folded into `id`; a bookmarked URL carries none, so it applies exactly once.
- The Ritual tab additionally seeds from the link **in its `useState`
  initializer** — tab screens mount lazily, so the first followed link mounts
  the screen with params already present and no change for the adjustment to
  notice. `withLink` sets day and step in **one** transition, because
  `withDate` restarts at step 0.

## Theming

`utils/theme.ts` is the single source of truth for every style value. **What
tokens mean lives in `docs/design.md` — read it before touching a style.**
Plumbing:

- **`useTheme()`** composes palette + density and is the only way components
  read style values. Inject varying values inline; keep static *layout* in
  `StyleSheet.create` (its values are static, so anything theme- or
  tier-dependent must be inline).
- `providers/ThemeProvider.tsx` resolves `preferences.themeMode` /
  `lightTheme` / `darkTheme` via the pure `resolveTheme`. With no provider
  (root chrome, unauthenticated screens, tests) `useTheme` falls back to the
  OS scheme. On web the first paint has no reliable `prefers-color-scheme`, so
  `useResolvedColorScheme` renders light then resolves in a layout effect
  (before paint).
- **Navigation surfaces must be themed explicitly** — a bare `<Stack>` renders
  a light header in dark mode; layouts pass screens through
  `createListScreenOptions`/`createModalScreenOptions`
  (`utils/stackOptions.ts`), and the root Stack sets a themed `contentStyle`
  so pre-paint gaps match the scheme.
- **Density is a pointer tier, not a multiplier** — compact on web ≥768px
  only; see `docs/design.md`.

## Auth

Supabase magic-link email + Google OAuth (PKCE) via `hooks/useAuth.tsx`; the
singleton client lives in `utils/supabase.ts`. Guards live in the layouts
(`(app)`/`(auth)`/`index`). The login email carries both a link and a code
(`verifyOtp({ type: "email" })`); the demo account routes through
`verify-demo-otp` instead — `isDemoEmail` is duplicated from the Deno module
(it can't be imported) and must stay identical; see `docs/backend.md`. The
callback URL is `Linking.createURL("auth-callback")` and both forms must be in
`config.toml`'s `additional_redirect_urls` **and** the hosted project's
allowlist. `app/oauth/consent.tsx` (outside the `(app)` group, self-guarding)
renders the OAuth-server consent screen; an unauthenticated visitor's
`authorization_id` is stashed (`utils/oauthReturn.ts`) and replayed after
sign-in.

## Error monitoring (Sentry)

`@sentry/react-native` via its Expo config plugin. Non-obvious parts:
`Sentry.wrap(RootLayout)` is plain composition, so it's React-Compiler-safe;
the exported `ErrorBoundary` can render when providers above it failed, so it
relies on `useTheme()`'s OS fallback; `QueryProvider` reports query/mutation
failures from cache-level `onError` handlers; source-map upload happens in
native build phases and needs the `SENTRY_AUTH_TOKEN` **EAS secret** (Release
profiles only — dev profiles set `SENTRY_DISABLE_AUTO_UPLOAD`). Triage with
the `/triage-sentry` skill.

**`SENTRY_ENABLED` in `app/_layout.tsx` is off in development**, and `debug`
follows that flag rather than `__DEV__`. Sentry's ingest domains are on
EasyPrivacy and most ad blockers' default lists, so on web the transport's
`fetch` is rejected before it leaves the tab, and `debug` printed the failure
once per envelope — every navigation, at `tracesSampleRate: 1.0`. Turning only
`debug` off would have hidden that while still filing developers' own
exceptions against the production issue stream. Flip the flag to `true` to
exercise reporting locally; leaving `debug: __DEV__` when disabled just
narrates events being discarded, which is why it is tied to the same constant.

## Data Layer

`api/` holds typed Supabase query modules; `hooks/` the React Query hooks;
`providers/QueryProvider.tsx` the query client. Freshness is three layers, no
interval polling (DEX-36):

- Shared 60s `staleTime` (`DEFAULT_STALE_TIME_MS`); device-backed hooks
  override it (AsyncStorage: `Infinity`; calendar sources: 10 min +
  `refetchOnMount: "always"`).
- **Focus refetch needs a native event source** — the browser's
  `visibilitychange` is free, but `QueryProvider` must tie
  `focusManager.setFocused` to `AppState` on native or foregrounding never
  refetches.
- `useRealtimeInvalidation` subscribes to `postgres_changes` and is
  **invalidation-only** — payloads are never written into the cache
  (unfilterable DELETEs, PK-only old records; see `docs/backend.md`). Bursts
  coalesce (~250ms); a channel rejoin invalidates every mapped key once, since
  Realtime does not replay missed events. **The per-date echo guard**: an
  autosave upsert echoes back as a realtime event, and refetching that date's
  row mid-mutation races the debounced editor — each notes/journals mutation
  is tagged with a per-date key, and invalidation skips only the date(s)
  currently mutating. Per-date, not per-table, because these mutations outlive
  their component and retry in the background — a stuck retry for one date
  must not suppress updates for another.

## Platform-split components

The four-file pattern (`.types.ts` / `.native.tsx` / `.web.tsx` / a `.tsx`
re-exporting native so `tsc` — which doesn't do platform-extension resolution
— can resolve the import). Notable splits:

- `NoteEditor`: native wraps `react-native-enriched-markdown` (uncontrolled —
  `defaultValue` + `onChangeMarkdown` so React never fights the caret); web is
  **read-only** (upstream #392). Native module → dev-client rebuild.
- `SearchField`: two files only; the native half renders `null` and can't be
  unit-tested — device-only verification.
- `GlassIconButton`: liquid glass on iOS with plain-circle fallback; needs an
  explicit `size` because the native menu host requires a fixed-size trigger.
  Its `active` prop exists because the *default* tint differs by platform —
  omitting it drew the button two different colors.
- `utils/alert.ts`/`alert.web.ts` (DEX-102): `showAlert` is `Alert.alert`
  native / `window.alert` web (RN's `Alert` silently no-ops there). Reach for
  it instead of another `Platform.OS === "web"` branch; the browser dialog has
  no title slot, so the message must read without one. `ConfirmationModal`
  (via `useConfirmation`) remains the answer when the user must *choose*.

### Subtasks and inline editing (DEX-70)

A subtask is a checklist item inside its parent's card, stored in the parent
row's jsonb (see `docs/backend.md`). Actions hang off a **tap**-triggered `⋯`
— the card is already wrapped in a long-press menu host, and nesting a second
long-press host inside it is the fragile arrangement.

`components/EditableText.tsx` commit rules (one place, every caller):
committed on blur, on return, **and on unmount-while-editing** (FlashList
recycles rows out from under a half-typed title); end edits via `blur()`,
never `Keyboard.dismiss()` (dismissing leaves the input focused, so the next
tap never fires the committing blur); an emptied title reverts for an existing
row but discards a never-saved one, decided by *origin*, not stored state;
editing is disabled once the task completes (re-opening a swept subtask
restores the state the sweep prevents); clearing edit mode on commit is
guarded by row id, because the outgoing row's cleanup runs *after* `editing`
moved to the next row.

`TaskCard` renders `task.subtasks` directly plus at most one never-persisted
`pending` row (an empty subtask fails MCP validation and would disable the
sweep). The optimistic cache write in `useTasks.onMutate` is load-bearing, not
cosmetic: `subtasks` is replaced wholesale, so anything composing the next
array from a stale read silently clobbers the edit before it —
`maybeCreateNextRecurringTask` reads the pre-write snapshot from `onMutate`'s
context for the same reason. **`TaskCard` inside a FlashList must be keyed by
`task.id`** — FlashList v2 recycles by reusing React keys (`keyExtractor` sets
only its own stableId), so without the key, edit state and focus survive into
whichever task lands in the recycled row.

`components/SubtaskFields.tsx` (shared by the new-task and repeat-schedule
forms) mirrors keystrokes into form state on every change — on native, Save
does not blur the focused input first, so a blur-committed row would be
dropped from the payload.

### Task links and the share extension (DEX-66)

The link value is **normalized, never rejected** — `utils/taskUrl.ts`
(import-free so the Deno MCP server applies the identical rule) trims, nulls
blanks, and prepends `https://` to bare hosts (the scheme match excludes
`:digit`, or `localhost:3000` reads as a scheme). Since nothing is rejected,
`utils/openUrl.ts` catches `Linking.openURL`'s rejection on garbage rather
than leaving a menu row that did nothing.

Sharing into Dexter (`expo-share-intent`; native — dev-client rebuild, inert
on web): `app/+native-intent.tsx` must swallow the extension's
`dexter://dataUrl=…` redirect or the router lands on Unmatched Route with the
modal over it. **Let the provider do the listening** — its `useShareIntent`
already covers every arrival path and publishes `hasShareIntent` only once the
payload is populated; re-subscribing underneath it re-derives that boolean
through a second path that drifts (as magic-meal-kit does). The redirect
effect must wait on **`useRootNavigationState()?.key`** — on a cold start the
payload can arrive before any navigator exists and the push is dropped
silently. Known gap: sharing while signed out loses the link (route params
don't survive the login redirect). **Don't hand-sync the extension's build
number**: the plugin already sets the extension's version from
`config.ios.buildNumber` so app and extension match by construction — Dexter
shipped exactly such a sync script and it failed the archive outright.

### Menus (`IconMenu` / `MoreMenu`)

`IconMenu` is `@expo/ui`'s `MenuView` on native, a custom overlay on web;
right-click is web's long-press (DEX-60), for `trigger="longPress"` menus
only. **`MoreMenu` is deliberately short: a menu row whose only job is to open
a picker is a detour, not a shortcut** (DEX-98) — everything a single tap
can't finish lives in the edit modal. The reason a picker sheet existed at all
still stands: neither platform's date picker can be opened imperatively (no
ref, no `isPresented`), so don't reach for "just focus the date field"
without a native module. The Schedule presets write immediately, so they keep
the alarm prompts; the edit modal writes nothing until ✓ and applies the same
rules silently.

Template rows: **a task is offered the two ways to make a template or the one
way to edit the one it has — never both** (DEX-65); `task.templateId` alone
picks the shape, the resolved row picks only the noun, and an unresolved
lookup keeps the repeat wording. Repeat and Save-as-template are one flow
(`id: "new"` + `fromTask`), differing only in the cadence the draft opens on.
Known consequence: a task made from a template can't become a repeat from its
card — the escape hatch is Duplicate (drops `template_id`) then Repeat.

Menu styling: `iconColor` on an iOS action button needs `@expo/ui` ≥ 57.0.8
(below that the system menu ignores `.foregroundColor`). The Android menu's
light/dark comes from `colorScheme`, fed from `useTheme().mode` — unset, the
Compose menu follows the *device* scheme, wrong whenever the in-app theme
disagrees; `mode` lives on the palette (not just `THEMES`) for exactly this.

**The one-open-task invariant** (recurrence spawns from *completing* a linked
task): don't create a second chain (`maybeCreateNextRecurringTask` checks
`hasOpenTaskForTemplate`, safe to ask the server in `onSuccess` because the
completing task is already terminal); don't leave zero (`seedNextOccurrence`
when a row gains a cadence — `getFirstOccurrence` counts today); and say so
when it hits zero anyway — the spawn is fire-and-forget, so Settings → Tasks
flags a stalled repeat with a ▶ that calls *literally the same code path*.
The MCP server mirrors both halves (`docs/backend.md`).

### Native-module load-bearing versions

- **`expo-modules-core` ≥ 57.0.8**: SwiftUI mutates its hosted platform view
  asynchronously even after teardown; before the isolation-container fix
  (carried here as a patch until upstream), those leaked mutations corrupted
  Fabric rendering — cards ballooned, collapsed, or whole days rendered blank
  (DEX-28). A downgrade brings the corruption back.
- **A patch to a *precompiled* Expo module never reaches the binary** —
  `patch-package` edits source that precompiled linking never compiles, and
  nothing warns. Only packages shipping `prebuilds/*.tar.gz` are actually
  precompiled (in SDK 57: `expo-modules-core`, `expo-file-system`,
  `expo-font`); everything else builds from source, patches included. Set
  `ios.usePrecompiledModules: false` only when patching one of those — check
  for the tarball, not `spm.config.json`.
- **Patch filenames carry the installed version and it is load-bearing** —
  after any dependency bump, re-run `npx patch-package <name>` so the filename
  tracks it; a mismatch is a warning locally and a hard `npm ci` failure in CI.

### Task alarms (AlarmKit, DEX-48)

iOS-only (`expo-alarm-kit`, iOS 26+); `utils/alarms.*` is platform-split with
the pure scheduling math in `alarms.shared.ts`. AlarmKit is a **projection of
DB state**: `hooks/useAlarmSync` reconciles what should exist against
`getAllAlarms()` with the **task id as the alarm id**, so set/complete/delete/
reschedule and background-created occurrences all self-heal on every launch.
Gotchas:

- Schedule changes on a task with an alarm **prompt only where the change is
  written immediately** (the menu presets); `TaskForm` applies the same rules
  silently because nothing is written until ✓, and a `ConfirmationModal` over
  a form sheet is a pointer-events hazard on web.
- The Alarm row's `TimeField` lower bound must exclude a saved alarm already
  in the past: a SwiftUI `DatePicker` given a range excluding its selection
  **clamps it and writes the clamped value back**, so keeping the bound would
  move the alarm just by opening the modal.
- The reconcile's session cache keys on **`alarmSignature`** — time, title,
  *and* sound — because AlarmKit reports back only ids, so an edit that moves
  no fire time is otherwise invisible (sound switches and retitles used to
  be).
- `useAlarmSync` reads the sound through `useAlarmSoundPreference` (needs an
  `isLoading` — scheduling against the placeholder row rings everything with
  the default and then re-schedules) and queues reconciles rather than letting
  them overlap (two in-flight runs race the session cache and can leave
  AlarmKit holding the loser's sound).
- The widget extension (`src/targets/DexterAlarmWidget/`, `@bacons/apple-targets`)
  must keep its metadata struct named exactly `Meta` to match what
  `expo-alarm-kit` schedules. All of this is native: dev-client rebuild, never
  OTA.
- Alarm sounds: `ALARM_SOUNDS` in `alarms.shared.ts` maps stored values to
  bundled filenames and resolves **unknown values to `undefined`** (a newer
  build's sound degrades to the system sound instead of ringing silently —
  also why `alarmSound` stays `string`, not a union). Adding a sound means a
  registry entry **plus** the file in `plugins/withAlarmSound.ts`'s list —
  AlarmKit resolves `soundName` against the app bundle, and that plugin is how
  a raw resource gets into it under CNG.

## Build and tooling

- **EAS dev client**, not Expo Go (`npm run dev:simulator` / `dev:ios` /
  `dev:android`; profiles in `eas.json`, `appVersionSource: remote`). Native
  tabs, the share extension, alarms, and the note editor all require it.
  Store release is the manual Build and Submit workflow — see
  `docs/appstore.md`.
- **Expo's generated type files are gitignored, so local and CI type-checking
  differ.** `expo-env.d.ts` and `.expo/types/router.d.ts` are written by
  `expo start`/`expo export`. A *stale* router.d.ts fails `npm run typecheck`
  on a route that exists — start the dev server once before believing it. CI
  has neither file, so a type-aware lint rule can pass locally and fail there;
  `src/global.d.ts` carries `/// <reference types="expo/types" />` for exactly
  this (DEX-95) — don't remove it. To reproduce a CI type result, move both
  generated paths aside; one is not enough.
- **Applying `expo-doctor`'s version bumps means regenerating the lockfile
  (DEX-116).** `expo install --check` rewrites `package.json` only, and npm
  will not bump a package it has already locked as a peer — an SDK patch bump
  pinning an exact transitive dep dies on `ERESOLVE` forever. The fix is
  `rm -rf node_modules package-lock.json && npm install`; repairing the old
  lock does not work. The regen floats every caret/tilde range, so a stricter
  `typescript-eslint` or `@types/*` can turn lint/typecheck red in untouched
  files — re-run all four checks afterward, and re-run `npx patch-package`
  for each patch in the same pass (a patch whose fix landed upstream stops
  applying: a warning locally, a hard failure in `npm ci`).
- Env: `.env.local` with `EXPO_PUBLIC_SUPABASE_URL` /
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `EXPO_PUBLIC_SENTRY_DSN` (see
  `src/README.md`). Regenerate DB types with `npm run supabase:types`.
- Web renders as a SPA (`web.output: "single"`) so `AuthProvider` doesn't run
  under Node SSR. React Compiler is on (`experiments.reactCompiler`). iOS
  deployment target is 26.1 (accessory, glass, AlarmKit).
- App icons: iOS uses an Icon Composer `.icon` bundle (own light/dark/tinted
  variants); Android adaptive icon PNGs are rasterized from the same
  `assets/app.icon/Assets/Vector.svg` source of truth.

## Mac Catalyst (experimental — DEX-85)

Opt-in behind `EXPO_MAC_CATALYST=1` (no EAS profile sets it; with it unset the
prebuild config is byte-identical). Three files carry it: `app.config.ts` (the
only reader of the flag; drops `@bacons/apple-targets`, forces
building-from-source because neither Expo's nor RN's published binaries have a
usable Catalyst slice), `plugins/withMacCatalyst.ts` (device family, excludes
`expo-alarm-kit`, empties the App Group entitlement; **every Podfile edit
asserts an exact match count** so a template change fails loudly — expect to
re-anchor on SDK upgrades), and `macCatalystStubs/` + a Metro alias (the
AlarmKit stub must report **success**, or `useAlarmSync` answers the throw
with a repeating alert). Build with `xcodebuild` (`expo run:ios` has no
`variant=` support); sanity-check `UIDeviceFamily` prints `6`, not `2`.
`IS_TABLET` covers Catalyst (idiom `mac`); `isAlarmSupported` excludes it.

Three native patches exist for this target (the first two compile-time-guarded
and inert on iOS):

| Patch | Why |
|---|---|
| `react-native+0.86.2.patch` | `UISwitch` resolves to an AppKit checkbox under the Mac idiom; sets sliding style and makes `RCTSwitchSize()` measure the same style. |
| `@expo+ui+57.0.8.patch` | SwiftUI resolves `Menu` to an AppKit pull-down, replacing custom `IconMenu` labels. Upstream: expo/expo#48448. |
| `expo-calendar+57.0.1.patch` | **Not Catalyst-specific** — `EKCalendarItem.calendar` is `null_unspecified` and a force-unwrap traps the JS thread. Upstream: expo/expo#48445. |

Not implemented: menu bar, multi-window, and any distribution path.
