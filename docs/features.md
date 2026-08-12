# Features

What each feature is and why it is shaped the way it is — the screens and the
tables behind them in one place. Rules that apply to *any* screen live in
`docs/frontend.md`, rules that apply to any table in `docs/backend.md`, and
endpoint contracts in `docs/api-routes.md`.

## Today

A thin selector over `SmallScreenToday`/`LargeScreenToday`, sharing only day,
preferences, and the backlog-attention signal. `hooks/useTasks.tsx` fetches once
under the canonical `["tasks"]` query — every incomplete task plus anything
scheduled in the last `RECENT_TASK_WINDOW_DAYS` (30) — and every view slices that
cached array client-side (`utils/taskFilters.ts`), so paging days is fetch-free
(DEX-57). Known limitation: older days show their incomplete tasks but not their
closed-out ones.

### Paging and panes

`components/SwipeablePage.tsx` (small screens) pages days with a pan gesture and
an intro fade/slide on a keyed remount — deliberately *not* an `entering` layout
animation, which on the new architecture intermittently leaves the subtree blank
or mis-measured. It is shared with the Ritual tab (prop is `pageKey`, not
`dateKey`). Its `canNext`/`canPrev` exist because `onEnd` does not reset
`translateX` on a commit (the host's key change remounts at zero; resetting first
is what flashed the old day back) — a bounded pager must decline the swipe
*inside* the component or the content parks where the finger left it.

Large screens: Tasks is always visible at a fixed `TASKS_PANE_WIDTH` — it does
**not** flex, so a `TaskCard` is the same shape at every window size and the
other panes absorb the width (DEX-111). Pane visibility persists per device via
`hooks/useTodayPanes.ts` (AsyncStorage, not the synced `preferences` row — a
per-device layout choice); `readPanes` rebuilds the stored value key by key so
removed panes' keys drop out. Notes and Calendar remount on date change (both
seed uncontrolled state once per mount).

The drawer toggle carries the overdue/left-behind **attention dot**
(`utils/taskFilters.ts`'s `backlogAttentionFilter` — Overdue first, else Left
Behind, as of the real today); the small-screen home for the dot is the
`DayViewSwitcher` trigger. Opening the drawer from those buttons pre-applies that
filter; on large screens the header toggle resets filter+search when *opening* —
load-bearing, or a `?mode=backlog` deep link's Unscheduled filter survives into
the header's "Backlog" action and shows a slice of what it promises.

### The task drawer

`components/TaskDrawer.tsx` (DEX-33) derives its scope from the `["tasks"]` cache
(`selectBacklogTasks`), all filtering/grouping/search client-side. Its rows' "+"
schedules through `useScheduleChange` (alarm prompt included). It renders a
flattened `{type: "header"|"task"}` FlashList so rows recycle — each row carries
`@expo/ui` native menu hosts, expensive in bulk. FlashList v2 is JS-only, which
is exactly why the drawer can virtualize while `TasksView`'s un-virtualized
`ScrollView` cannot (a *native* recycler's off-viewport churn aggravates the
hosts' async sizing, expo/expo#42576). The app deliberately runs
`@shopify/flash-list` newer than the SDK pin, listed in `package.json`'s
`expo.install.exclude` (DEX-116) so `expo install --check` stops proposing the
downgrade.

Two things are load-bearing in the small-screen sheet (`TaskDrawerSheet`,
`@expo/ui` bottom sheet): the Filter/Group control inners need an **explicit
`height`** (the host-sizing rule in `docs/frontend.md`), and the drawer root +
FlashList both need `flex: 1` or the list lays out at full content height and
overflows instead of scrolling. The sheet is imperative (`present(filter?)` —
`BottomSheetModal` has no controlled visible prop) and defers rendering the
drawer until first open. It presents *over* the tab bar, so it corrects the
inherited bottom inset with a `SafeAreaInsetsContext.Provider` `bottom: 0`
(`testUtils/renderWithBottomInset.tsx` drives tests through the same mechanism).

### Calendar

`components/CalendarView.tsx` is a themed timeline bounded by the user's
start/end hours; `utils/calendarLayout.ts` clamps and packs overlapping events;
times are hand-formatted (`utils/formatPlainTime.ts` — Hermes ships a partial
`Intl`). The source is the platform-split `hooks/useCalendarEvents.*` (native:
`expo-calendar` + device-local `useEnabledDeviceCalendars`; web: `.ics` feeds
through the `ics-proxy` function, parsed by `utils/icsEvents.ts`), normalized to
one `TCalendarEvent`. `notConfigured` is computed in both platform files from
what they already know — no extra permission prompt. On today the timeline
auto-scrolls once on first layout (`scrollOffsetForTarget`), covered for both
"view loads" and "day changed" by the per-day remount.

### Notes and journals

`components/NotesView.tsx` autosaves the day's markdown debounced; a day with no
row offers template/blank (both write a row, so the choice persists — `useNotes`
exposes `exists` and never auto-seeds). `components/JournalView.tsx` (Ritual tab
only since DEX-105) autosaves `journals.prompts` wholesale; responses are plain
text; both rituals edit the same per-date entry.

`public.notes` (`content text`) and `public.journals` (`prompts jsonb`, checked to
be an array) are each keyed `(user_id, date)` — one row per user per date, no
`id`, no `updated_at`. They replaced a shared `days` row (DEX-51; `days` dropped
in DEX-90 once the legacy `dexter-app`, which shares this production project, had
shipped a release reading the new tables).

**"No row" means "never written", and the app depends on that** — the template
chooser keys off `exists`. The split's backfill preserved the distinction
deliberately: for journals, only days with at least one non-empty *response* were
copied, because the old shared row seeded template prompts on the first note
write, so most rows carried scaffolding the user never answered.

## Week

Seven Monday-first columns (DEX-96), each reusing `components/DayTaskList.tsx`
(extracted so the repeat-aware delete confirmation isn't re-derived). Labeled
from ISO `weekOfYear`/**`yearOfWeek`**, not `year` — a week can belong to the
neighbouring calendar year, which the legacy app got wrong; math lives in
`utils/weekStartEnd.ts`.

The columns live in a horizontal **`DraxScrollView`**: a plain `ScrollView`
registers no scroll offset with drax, so after sideways scrolling every drop
would land on the wrong day. Columns are deliberately read-only chrome — no
per-column "+", `emptyMessage={null}`, no create nudge (seven copies of anything
read as noise) — and run **flush**: all horizontal spacing comes from the row's
`gap`, which the today-anchor also derives its column pitch from, so the two must
move together (DEX-115; see `docs/design.md`, "Who owns spacing").

The docked backlog stays outside the scroller; its drawer is uncontrolled here on
purpose — the controlled filter, dot, and deep-link seeding are Today's contract,
and reusing `useTodayPanes` would open the backlog on both tabs at once. Known
cost: with habits on, seven `HabitTracker`s mount with their own queries; a range
query is the fix if it ever shows.

## Ritual

A guided walk through the start/end of a day (DEX-127). The route owns one
`TRitualState` (`{date, mode, step, direction}` plus one boolean per optional
step) and branches on `useIsLargeDevice()`.

**Every rule lives in `utils/ritualSteps.ts`, and nothing in it is React** — step
lists, the noon boundary, and all transitions are pure functions. Load-bearing
contracts:

- Transitions return **the same object** for a no-op (either end of the list, the
  value already on screen) so a declined swipe doesn't re-render and restart the
  intro animation.
- **The step list is derived; state carries the input (booleans), not the output
  (an array).** `stepsFor(state)` picks a precomputed list off the enabled flags
  — precomputed because both switchers map the result every render and fresh
  arrays would defeat identity comparisons downstream. `state.step` indexes a list
  that can shrink, so it may only be produced by a transition in that module —
  never `{ ...state, step: n }` at a call site.
- **The `withXEnabled` transitions move the user by step *id*, not index** — a
  clamp would silently move someone from Calendar to Backlog when an earlier step
  is removed. Preserving the id also keeps `ritualPageKey` unchanged so
  `SwipeablePage` doesn't remount for a preference flipped in another tab.
  (`usePreferences` serves defaults until the row loads, so a cold launch corrects
  a round trip later — the correction has to be unremarkable, and it runs in both
  directions since journal/horoscope default on but calendar defaults off.)
- The "unchanged" guard stays on each exported transition because
  `ritual/index.tsx` compares each flag against preferences **during render** and
  sets state on disagreement — a transition that returned a state without updating
  its flag would spin the render loop forever.

The swipe pages **steps**, runs at every width (unlike Today, where large screens
page by arrows — a ritual is a sequence you move through, so the gesture means
something), and is suspended while a step reports editing.
`components/RitualStepView.tsx` is the seam: it branches on `step.id` and unbuilt
steps fall through to a placeholder, which is what lets sub-issues fill steps in
without touching the flow. The step's `onEditingChange` must be passed
**unwrapped** (a `useState` setter, never an inline arrow) — a downstream cleanup
depends on its identity, and a fresh function per render clears the editing flag
on focus.

The step control mirrors Today's split (menu on small screens, segments on
large); on iOS the segments are a real SwiftUI segmented `Picker` for liquid
glass, pinned to exact pixels for the reason `docs/frontend.md` gives about
`@expo/ui` host sizing. The drawn `SegmentedControl` (Android/web) needs
`stretch={false}` in the header's actions row, which has no width of its own —
`flex: 1` segments would divide nothing and collapse.

`components/HeroLines.tsx` is shared by the reporting steps: right-aligned
figures, left-aligned words, the figure column **measured** (widest raises a
`minWidth`, converges in one pass, monotonic so a shrinking figure never re-flows
the hero under the reader), each row one accessibility node carrying the whole
phrase. Stage timing lives in `useHeroReveal`/`useStageOpacity`; the reveal is
opacity-only — `SwipeablePage`'s intro already slides, and two axes compound into
a diagonal drift.

### Horoscope step (DEX-128, re-shaped in DEX-145)

Read-only client of `public.horoscopes` (`["horoscopes", sunSign, date]`),
deliberately not realtime (rows change once a day). The panel's colors and frame
are `docs/design.md`'s Sentiment section.

- **The tips are the app's only custom-font text** (`SERIF`, see
  `docs/design.md`), and the reason `app/_layout.tsx` holds the splash at
  startup. Both resets on those styles are load-bearing — see the design doc.
- **The hero shows the first tip, and `horoscopes.text` is never rendered at
  all.** The column is still fetched and stored — it is the horoscope proper —
  but as a hero it was three sentences of astrological mechanism ("Mars strains
  against the Sun's natal position") where the tips are the part written *to* the
  reader. Keep it stored; putting it back on screen is a decision, not a fix, and
  a test asserts it stays off.
- **The hero is sized to exactly one screenful**, so whatever it holds is a
  layout constraint rather than a detail — a taller hero pushes the chevron off
  the fold and breaks the scroll-to-reveal conceit the whole step is built on.
- **Balanced wrapping is per-platform and partial.** The tips carry
  `BALANCED_WRAP` — `textBreakStrategy` genuinely balances on Android,
  `lineBreakStrategyIOS: "standard"` is a nudge rather than the same thing (iOS
  has no balance option), and web gets nothing because CSS `text-wrap: balance`
  is not an RN style key. There is no cross-platform API and no library:
  react-native-community/discussions-and-proposals#890 is the open ask.
- Below the fold: the remaining `tips`, then the twelve life areas sorted into
  three stacked bands by rating (`lifeAreasInBucket`), each a mark beside its
  areas joined into one string. Three parallel *columns* were the first cut and
  were cut: they gave every band the same third of the card however the ratings
  fell, so a day with one bad area and eleven good ones drew two near-empty
  columns beside a crowded one. A band can legitimately be empty — a day with
  nothing rated 1-2 is a good day — and it still draws its row, with an em dash,
  so the legend keeps its shape from one morning to the next.
- `components/StarField.tsx` is **seeded, not random** (a sky must not reshuffle
  per render); stars deal into four layers with one shared opacity animation each
  (a shared value per star would drive a worklet per frame), with co-prime periods
  so they never re-align into one pulse. Star count is the cheap dial, layer count
  is not. The panel carries no `overflow: hidden` — clipping to a radius makes it
  an offscreen-rendered layer re-composited every frame a child animates.
- The audio (`hooks/useHoroscopeAudio.ts`) is built on `createAudioPlayer`,
  **not** the `useAudioPlayer` hook — the hook releases its player at unmount,
  which cuts audio dead with no window to fade; owning the player lets cleanup
  ride the volume down and then release, at the price that every exit path must
  end in `remove()`. `MAX_VOLUME` is linear amplitude against logarithmic hearing
  (0.5 is only −6dB — reported as "no change"). **On iOS browsers none of the
  volume work happens** — Apple reserves `HTMLMediaElement.volume` for the
  hardware buttons, so mobile-web tracks play at device volume and cut instead of
  fading; that's this, not the arithmetic. `expo-audio`'s config plugin is
  deliberately not installed (it only adds microphone permissions; this is
  playback-only).

**The table.** `public.horoscopes` (DEX-84; rebuilt for astrology-api.io v3 in
DEX-145) holds one sun-sign horoscope per day — a short prose `text`, an
`overall_rating`, three `tips`, and a rating for each of twelve life areas. It is
the first table in this schema that **nobody owns** (global reference data),
which drives its shape:

- **No `user_id`, no `id`.** PK is `(sun_sign, date)` — `sun_sign` first so the
  leftmost prefix also serves `where sun_sign = $1 order by date desc`. No
  secondary index; twelve rows a day is a trivial scan.
- **RLS: a single `for select using (true)` policy and no write policy** — the
  absence of a policy is the denial. Grants are stated by name (see
  `docs/backend.md` — this is where that general rule came from).
- **`sentiment` is a generated column**, bucketed from `overall_rating` (≥4
  positive, ≤2 negative, else mixed) rather than written by the function. The UI
  groups each life area with the same thresholds, so the card's tint and the
  bands under it cannot disagree.
- Not in the realtime publication (rows change once a day).
- The fixtures were written from a real response twice over, and both times the
  published sample disagreed with the wire format — DEX-84 against fields the
  live API no longer sent, DEX-145 against the `{ success, data, metadata }`
  envelope the vendor's sample omitted. `docs/testing.md` carries this as a rule.

**Which row is yours** is `preferences.sun_sign` (DEX-128) — the same
`public.sun_sign` enum, so the lookup can't drift. It is the one preference that
is **nullable with no default**: guessing a sign would show a stranger's
horoscope as though it were the user's, so "not set" is a real rendered state.
**Whether you see one at all** is `preferences.enable_horoscope` (DEX-142,
`boolean not null default true` — the step shipped on, and any other default
would silently take it away). It is independent of `sun_sign` (toggling off keeps
the chosen sign) and read-side only — generation writes global rows regardless.

Generation is `api-routes.md`'s `generate-horoscopes` and its cron job.

### Calendar step (DEX-140)

Three `HeroLines` over the unchanged `CalendarView`. The arithmetic
(`utils/calendarStats.ts`, React-free) has three decisions worth keeping:
**planned time is the union of event spans, not the sum** (double-bookings must
not report thirty-hour days) and it **clamps before it merges** (an event running
in from yesterday contributes only its in-window part); the window is the user's
own configured hours, derived once (`calendarWindow`) so the number can't
disagree with the grid drawn under it; and **`layoutEvents` is deliberately not
reused** — it floors heights and inflates zero-length events, drawing decisions
that would be lies in a total. The step checks `isLoading` **before**
`notConfigured` — an unresolved read looks exactly like an unconfigured one, and
testing the source first flashes the setup prompt at configured users on every
cold open.

### Backlog step (DEX-141)

Three `HeroLines` over the Today drawer's `TaskDrawer` (search field hidden — the
one divergence from "same controls as today").

- **Counts anchor to today while the scope is the ritual's day** — `TaskDrawer`
  filters against today whichever day is shown, and a hero that disagreed with
  the list under it is worse than none. Both read the one `useTasks()` query, so
  clearing a task drops it from count and list in the same render.
  `backlogCounts` is built from `filterTasks(...).length` so a figure can never
  drift from the preset it labels; buckets overlap on purpose.
- **The filter follows the reader down the buckets, and only emptiness moves
  it.** `defaultBacklogFilter` picks the opening preset; `nextBacklogFilter`
  advances only when the current bucket empties, and the advance is **written
  back to state, not merely derived** — left derived, refilling the emptied
  bucket (un-complete, another device) would yank the list off whatever the
  reader moved on to. Set-state-during-render; it can't loop because an advance
  always lands on a non-empty bucket.
- The drawer half is a separate `BacklogList` component so its lazy state
  initializer never sees `useTasks`' empty placeholder — the same latch inside
  the step would fight two `react-hooks` lint rules that are both right. The step
  checks `isLoading` first or the all-clear hero congratulates a cold cache.

### Summary step (DEX-144)

The last step of **both** rituals (id `summary`, so it doesn't drift from the
label): habits/events/tasks counted through the same `HeroLines`, over a button
into `todayRoute({ date, mode: "tasks" })`, the two centered as one block.

- **A morning task-list step was built here first and removed.** `DayTaskList`
  dropped into the step worked and cost almost nothing — but it copied a surface
  it could not replace, leaving two lists of the same day a swipe apart, where
  the ritual is a sequence you walk once and the day's list is what you return to
  all day. Reach for this history before re-proposing it. The evening's Open
  tasks step below is **not** a reversal of it: see there for the axis the two
  differ on.
- **The link carries the ritual's date, and needs its `n` nonce** for the same
  reason the Search tab's does: cross-tab navigation reuses the mounted Today
  screen and only swaps its params, so two presses carrying one date would be
  indistinguishable and the second would switch tabs and do nothing.
- **A line exists per feature the reader has, not per non-zero count.** A zero is
  a reading — it is why the button is there — but a calendar line for someone
  with no calendar is noise, so `enableHabits`/`enableCalendar` decide which lines
  exist and the counts only decide what they say. All three figures take
  `colors.primary` rather than the sentiment colors of the two reporting steps:
  this summarizes a day the reader has just finished planning, and none of its
  numbers is bad news.
- **The button is staged at `heroLines.length`, not `BODY_STAGE`.** That constant
  means "after all three hero lines" and is right for the two steps that always
  draw three; this one draws as few as one, and waiting for stage 3 there would
  leave the button missing for most of a 3.6s sequence.
- **It passes `bodyInsetTop` to cancel `HeroLines`' own bottom compensation.**
  That padding evens out the ritual layout's step inset for a hero anchored to
  the top of the step — which is what the calendar and backlog steps have.
  Centering a block instead makes it bottom-heavy, pulling the figures above true
  center, so this is the one caller that zeroes it out.
- An entirely empty day replaces the figures with one line
  (`summary-step-blank`) and keeps the button. `isLoading` is checked first or a
  cold cache tells someone with a full morning they have nothing on.

### Open tasks step (DEX-146)

The evening ritual's first step: one `HeroLines` count over the day's still-open
tasks, each row between a leading Unschedule button and a trailing move-to-the-
next-day one. Load-bearing:

- **It is not the morning task-list step the Summary section records being
  removed**, and the difference is the axis that one failed on. That step copied
  a surface it could not replace; the evening ritual has no other task list to
  duplicate, and every row here exists to be *dispatched* by one of the two
  buttons rather than read. The list empties as it is worked, which is the step.
- **Scope is the ritual's day and only what is still open** —
  `selectOpenTasksForDate`, which is `selectTasksForDate` narrowed by the same
  `isCompletionStatus` the backlog scope uses. Stragglers from earlier days stay
  the morning Backlog step's business; pulling them in makes the evening list the
  thing it exists to close.
- **Both buttons write through `useScheduleChange`, never `updateTask`** — the
  alarm rule the drawer's "+" learned the hard way (DEX-77). The right arrow
  targets **`date.add({days: 1})`, not the real tomorrow**: `DayNav` can page the
  ritual anywhere, and both labels name the day (`formatWeekdayMonthDay`) rather
  than saying "tomorrow", so a paged ritual can't lie about where a task went.
- **The body is staged at `heroLines.length`, not `BODY_STAGE`** — the same trap
  the Summary step documents, and sharper here since this hero is always one line.
- `isLoading` is checked before the all-clear, or a cold cache throws confetti at
  someone whose evening is full.
- `components/Confetti.tsx` is the all-clear's, built like `SunriseBackground`
  (measured box, one linear driver, per-piece windows) over a deterministic
  React-free field in `utils/confetti.ts` — seeded for the reason `starField.ts`
  gives, since the step re-renders under it while the burst is in flight. Two
  deliberate divergences from its neighbours: it takes **theme colors** where the
  sunrise takes fixed hexes (a sunrise in the user's palette isn't a sunrise,
  where confetti has no true color), and it renders **nothing at all** under
  reduced motion rather than settling — its settled state is paper hanging in
  mid-air, which reads as a bug.
- `hooks/useTaskDelete.ts` holds the repeat-aware delete this step and
  `DayTaskList` share. A second copy is what would let one surface drop a repeat
  schedule while the other keeps it. (`TaskDrawer` still deletes straight through
  — a pre-existing divergence, not a decision.)

## Drag-to-schedule (DEX-77)

Large screens only (a phone's backlog is a native sheet a drag can't cross), and
never the only path — the row "+" and the Schedule submenu remain for keyboard
and screen readers. Library is `react-native-drax` (pure JS, OTA-safe).
`useDragSchedule()` returns `null` outside the provider and both ends degrade to
plain views, which is what keeps `DraxView` off small screens without threading
an enable prop.

- **Drax caches a view's props in its registry** at registration, refreshing only
  when a *capability* prop changes, and dispatches off that snapshot. So drop
  handlers must be identity-stable closures reading refs (`useCallback` keyed on
  the date is *not* a fix — a new identity is what the registry declines to pick
  up), and the drag **payload is a task id** resolved at drop time, never the
  task object, which would freeze stale.
- **The drop target is the whole day column**, which is what makes an empty day
  droppable given `emptyMessage={null}`.
- **Activation is by direction, not time** (`utils/dragActivation.ts`): a card
  sits under a vertical list scroll and a long-press context menu, so
  `longPressDelay: 0` + activate on sideways travel + fail on vertical. Every
  meaningful drop is sideways. A timed hold was tried twice and **cannot work**:
  `activateAfterLongPress` activates regardless of movement, so below the menu's
  ~500ms it silently cancels the menu and above it loses the drag — presenting as
  intermittent. The per-axis `dragActivationOffsetX`/`dragActivationFailOffsetY`
  props come from `patches/react-native-drax+1.1.0.patch`, which touches `src/`,
  `lib/typescript/` and `lib/module/` so every entry point agrees.
- **The hover preview is a static shell** (`TaskCardPreview`) — drax's default
  re-renders the dragged children into its overlay, which would mount a second
  set of async-sizing `@expo/ui` hosts that report 0 on native. It needs
  `alignSelf: "flex-start"` and an explicit width; drax's wrapper shrink-wraps and
  a `stretch` child collapses to zero on device.

`hooks/useScheduleChange.ts` is the one path `scheduledFor` changes through —
extracting it fixed the backlog "+" moving a task off its alarm's day and leaving
the alarm behind.

## Search (DEX-47)

Search does **not** filter the client task cache (30-day window — it would
silently miss older completed tasks); `hooks/useSearch.tsx` calls the
`search_entries` Postgres function (`docs/api-routes.md`). The input is the
platform-split `components/SearchField.*`: native is `Stack.SearchBar` (renders
`null`, appends itself to navigation options; **uncontrolled** — `value` is
ignored; `onChangeText` hands back a `NativeSyntheticEvent`, unwrapped so both
halves share one string contract), web is an in-body `TextInput` because
react-native-screens implements the header bar on iOS/Android only.

The query debounces through `useDebouncedValue` — deliberately a timer and not
`useDeferredValue`, which is a rendering-priority hint, not a throttle: when the
deferred render is cheap every keystroke still reaches the server. Results group
into sections (substring matching has no relevance score to interleave by);
`utils/searchHighlight.ts` collapses whitespace *before* matching so offsets index
the rendered string, and falls back to the head of the text — `ilike` case-folds
by collation while the client uses `toLowerCase()`, and they disagree on some
Unicode.

The screen frames itself with **`react-native-screens/experimental`'s
`SafeAreaView`** (DEX-107): `Stack.SearchBar` forces the header translucent,
react-native-screens lays the body under the navigation bar and its one automatic
compensation walks a first-child chain once at mount — when the screen shows its
idle state, not the list — while the context's per-tab top inset is only the
status bar. The screens `SafeAreaView` reads insets from `RNSScreenView`, which
includes the bar and re-dispatches as UIKit hides/shows it (visible on iPad, where
the search field stays in the header). That entry point warns its symbols may
break without a major version — **re-check the Search tab on an iPad after any
`react-native-screens` bump**, patch releases included.

### Deep links

The contract lives in three modules: `utils/routeParams.ts` (shared primitives),
`utils/todayRoute.ts` / `utils/ritualRoute.ts` (each owns **both directions** for
its tab so builder and parser can't drift), and `utils/searchRoute.ts` (which tab
a result goes to; the split avoids an import cycle). Malformed dates parse to null
and fall back to today — these are web URLs, so a hand-edited value is a real
input. Two results deliberately have no route (`canOpenSearchResult`): a completed
task with no scheduled date (the backlog can never show it) and a journal entry
while the journal is disabled.

Plumbing that is easy to undo by accident:

- **`openPane`, not `togglePane`** — a toggle guarded at the call site puts
  `panes` in the effect deps, so every later toggle re-runs the effect and
  re-opens what the user just closed.
- **The state syncs are render-phase adjustments, not effects** (the
  `react-hooks/set-state-in-effect` pattern): a `useState` initializer (right when
  arriving with the link already set) paired with an applied-value guard
  (re-applies later changes without stomping the user's own navigation). Dropping
  either half breaks a different case.
- **Guards key on `link.id`, not contents.** Cross-tab navigation does not remount
  the screen (a `push` downgrades to `JUMP_TO`), so a value-comparing guard can't
  tell "already applied" from "applied, user navigated away, asked again".
  `searchResultRoute` stamps each tap with an incrementing nonce folded into `id`;
  a bookmarked URL carries none, so it applies exactly once.
- The Ritual tab additionally seeds from the link **in its `useState`
  initializer** — tab screens mount lazily, so the first followed link mounts the
  screen with params already present and no change for the adjustment to notice.
  `withLink` sets day and step in **one** transition, because `withDate` restarts
  at step 0.

## Tasks

### Subtasks and inline editing (DEX-70)

A subtask is a checklist item inside its parent's card. Actions hang off a
**tap**-triggered `⋯` — the card is already wrapped in a long-press menu host, and
nesting a second long-press host inside it is the fragile arrangement.

`components/EditableText.tsx` commit rules (one place, every caller): committed on
blur, on return, **and on unmount-while-editing** (FlashList recycles rows out
from under a half-typed title); end edits via `blur()`, never
`Keyboard.dismiss()` (dismissing leaves the input focused, so the next tap never
fires the committing blur); an emptied title reverts for an existing row but
discards a never-saved one, decided by *origin*, not stored state; editing is
disabled once the task completes (re-opening a swept subtask restores the state
the sweep prevents); clearing edit mode on commit is guarded by row id, because
the outgoing row's cleanup runs *after* `editing` moved to the next row.

`TaskCard` renders `task.subtasks` directly plus at most one never-persisted
`pending` row (an empty subtask fails MCP validation and would disable the
sweep). The optimistic cache write in `useTasks.onMutate` is load-bearing, not
cosmetic: `subtasks` is replaced wholesale, so anything composing the next array
from a stale read silently clobbers the edit before it —
`maybeCreateNextRecurringTask` reads the pre-write snapshot from `onMutate`'s
context for the same reason. **`TaskCard` inside a FlashList must be keyed by
`task.id`** — FlashList v2 recycles by reusing React keys (`keyExtractor` sets only
its own stableId), so without the key, edit state and focus survive into whichever
task lands in the recycled row.

`components/SubtaskFields.tsx` (shared by the new-task and repeat-schedule forms)
mirrors keystrokes into form state on every change — on native, Save does not blur
the focused input first, so a blur-committed row would be dropped from the
payload.

**Storage is a jsonb array, not rows** (`tasks.subtasks`,
`repeat_task_templates.subtasks`). The array buys: one level deep by
construction; completing a parent sweeps its checklist in a single row update; no
orphan-spawn hazard. Accepted tradeoffs and traps:

- **Last-write-wins on the whole array** — concurrent editors clobber each other
  within a refetch window; the mitigation if ever needed is RPC array surgery, no
  schema change.
- **Promotion is two non-atomic writes** (insert task, rewrite parent array); a
  crash between them leaves a duplicate, not data loss. A promoted subtask never
  inherits `alarm_time`.
- **Write bounds are not read bounds** — `tools/helpers.ts` has bounded schemas
  for tool input and separate unbounded ones for parsing stored rows. Reusing the
  input schema on a read is a trap: a failed parse means "no subtasks", so an
  over-long stored title would silently skip the completion sweep.
- **Every write path that can complete a task sweeps** — including `create_task`
  inserting an already-complete task.

### Task links and the share extension (DEX-66)

The link value is **normalized, never rejected** — `utils/taskUrl.ts`
(import-free so the Deno MCP server applies the identical rule) trims, nulls
blanks, and prepends `https://` to bare hosts (the scheme match excludes
`:digit`, or `localhost:3000` reads as a scheme). Since nothing is rejected,
`utils/openUrl.ts` catches `Linking.openURL`'s rejection on garbage rather than
leaving a menu row that did nothing. `tasks.url` is unvalidated in the database
and at the MCP boundary for the same reason: rejecting a malformed link would fail
a write over an optional field. Templates have no counterpart, for the same reason
they have no `due_on` — a link belongs to the task, not the schedule that mints
it.

Sharing into Dexter (`expo-share-intent`; native — dev-client rebuild, inert on
web): `app/+native-intent.tsx` must swallow the extension's `dexter://dataUrl=…`
redirect or the router lands on Unmatched Route with the modal over it. **Let the
provider do the listening** — its `useShareIntent` already covers every arrival
path and publishes `hasShareIntent` only once the payload is populated;
re-subscribing underneath it re-derives that boolean through a second path that
drifts (as magic-meal-kit does). The redirect effect must wait on
**`useRootNavigationState()?.key`** — on a cold start the payload can arrive before
any navigator exists and the push is dropped silently. Known gap: sharing while
signed out loses the link (route params don't survive the login redirect).
**Don't hand-sync the extension's build number**: the plugin already sets the
extension's version from `config.ios.buildNumber` so app and extension match by
construction — Dexter shipped exactly such a sync script and it failed the archive
outright.

### Repeats and templates

**Repeat tasks recur in TypeScript, not Postgres.** Completing a task linked to a
`repeat_task_templates` row creates the next occurrence via
`src/utils/repeatSchedule.ts` (croner-backed, shared over `@src/`); the old
Postgres trigger was dropped. `delete_task` also deletes a linked *scheduled*
template so occurrences stop — a scheduleless one is a saved template the user may
still stamp from, and survives.

**A `repeat_task_templates` row with NULL `schedule` is a task template, not a
repeat (DEX-65).** Nothing recurs from a scheduleless row, so one table serves
both; switching between them is writing or clearing `schedule`. The column has
**no default**, so every insert must state its schedule — `create_template` with
`schedule` omitted creates a task template.

**The one-open-task invariant.** Recurrence spawns from *completing* a linked
task, so:

- *Don't create a second chain.* `maybeCreateNextRecurringTask` (app) and
  `hasOpenTaskForTemplate` (`functions/mcp-server/tools/recurrence.ts`, DEX-94)
  both skip the spawn when another open task links to the template; a failed
  lookup reads as "has one", because an extra chain is silent and permanent while
  a stalled repeat is surfaced and repairable. The app can safely ask the server
  in `onSuccess` because the completing task is already terminal.
- *Don't leave zero.* `seedNextOccurrence` fires when a row gains a cadence
  (`getFirstOccurrence` counts today); `create_template`/`update_template` seed a
  first occurrence best-effort, never failing the template write.
- *Say so when it hits zero anyway.* The spawn is fire-and-forget, so Settings →
  Tasks flags a stalled repeat with a ▶ that calls literally the same code path.
- Deliberately not applied to `create_task`/`update_task`'s `templateId` — the app
  has the same gap, and the ▶ repair covers it.

Menu rows: **a task is offered the two ways to make a template or the one way to
edit the one it has — never both** (DEX-65); `task.templateId` alone picks the
shape, the resolved row picks only the noun, and an unresolved lookup keeps the
repeat wording. Repeat and Save-as-template are one flow (`id: "new"` +
`fromTask`), differing only in the cadence the draft opens on. Known consequence:
a task made from a template can't become a repeat from its card — the escape hatch
is Duplicate (drops `template_id`) then Repeat.

### Alarms (AlarmKit, DEX-48)

iOS-only (`expo-alarm-kit`, iOS 26+); `utils/alarms.*` is platform-split with the
pure scheduling math in `alarms.shared.ts`. AlarmKit is a **projection of DB
state**: `hooks/useAlarmSync` reconciles what should exist against
`getAllAlarms()` with the **task id as the alarm id**, so set/complete/delete/
reschedule and background-created occurrences all self-heal on every launch.
`tasks.alarm_time` (`time`, nullable, also on templates) is the stored half; a
recurred occurrence copies the template's, so repeats keep their alarm.

- Schedule changes on a task with an alarm **prompt only where the change is
  written immediately** (the menu presets); `TaskForm` applies the same rules
  silently because nothing is written until ✓, and a `ConfirmationModal` over a
  form sheet is a pointer-events hazard on web.
- The Alarm row's `TimeField` lower bound must exclude a saved alarm already in
  the past: a SwiftUI `DatePicker` given a range excluding its selection **clamps
  it and writes the clamped value back**, so keeping the bound would move the
  alarm just by opening the modal.
- The reconcile's session cache keys on **`alarmSignature`** — time, title, *and*
  sound — because AlarmKit reports back only ids, so an edit that moves no fire
  time is otherwise invisible (sound switches and retitles used to be).
- `useAlarmSync` reads the sound through `useAlarmSoundPreference` (needs an
  `isLoading` — scheduling against the placeholder row rings everything with the
  default and then re-schedules) and queues reconciles rather than letting them
  overlap (two in-flight runs race the session cache and can leave AlarmKit
  holding the loser's sound).
- The widget extension (`src/targets/DexterAlarmWidget/`,
  `@bacons/apple-targets`) must keep its metadata struct named exactly `Meta` to
  match what `expo-alarm-kit` schedules. All of this is native: dev-client
  rebuild, never OTA.
- Alarm sounds: `ALARM_SOUNDS` in `alarms.shared.ts` maps stored values to bundled
  filenames and resolves **unknown values to `undefined`** (a newer build's sound
  degrades to the system sound instead of ringing silently — also why
  `preferences.alarm_sound` (DEX-72) stays `text not null default 'echos'` and
  `alarmSound` stays `string`, not a union). Adding a sound means a registry entry
  **plus** the file in `plugins/withAlarmSound.ts`'s list — AlarmKit resolves
  `soundName` against the app bundle, and that plugin is how a raw resource gets
  into it under CNG.
