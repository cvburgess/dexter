import { Temporal } from "@js-temporal/polyfill";

/**
 * The Ritual flow's model (DEX-127): which steps exist, which half of the day
 * they belong to, and every transition between them.
 *
 * Deliberately React-free — and import-free besides `Temporal` — so the whole
 * rule set is unit-testable without a native host, the same split
 * `dayViewOptions` uses in `DayViewSwitcher`. That is also why the journal
 * preference arrives as a bare boolean rather than a `TPreferences`: importing
 * `@/api/preferences` would drag the Supabase client into this leaf's module
 * graph. `ritual/index.tsx` holds the one `TRitualState` and does nothing but
 * hand it to the transitions below.
 *
 * **`state.step` indexes a *derived* list** (see `stepsFor`), so it may only
 * ever be produced by the transitions in this module — never by a
 * `{ ...state, step: n }` at a call site. Every guard here depends on that, and
 * it became load-bearing once the list could shrink under a mounted screen.
 */

/** Morning or evening ritual. */
export type TRitualMode = "am" | "pm";

/**
 * Every step's id, spelled out once — as values, so `utils/ritualRoute.ts` can
 * validate one that arrived from a route param, and as the union derived from
 * them.
 *
 * One list rather than a hand-written union beside a hand-written array: the
 * two would have no compile-time link, so a tenth id added to only one of them
 * would leave `parseRitualStep` silently rejecting a step that exists and the
 * deep link to it dying with no error anywhere.
 */
export const RITUAL_STEP_IDS = [
  "horoscope",
  "journal",
  "calendar",
  "backlog",
  "summary",
  "open-tasks",
  "review",
  "preview-tomorrow",
] as const;

/**
 * Every step's id, as a literal union.
 *
 * Enumerated (rather than inferred from `RITUAL_STEPS`) so
 * `components/RitualStepSwitcher.shared`'s icon table is a `Record` over it and
 * the compiler catches a step added without one. Some ids appear in both
 * rituals (`journal`, `summary`) — they are the same step at a different time
 * of day, so they share an icon.
 */
export type TRitualStepId = (typeof RITUAL_STEP_IDS)[number];

export type TRitualStep = {
  /** Unique within its mode; part of the swipe pager's remount key. */
  id: TRitualStepId;
  /** Rendered as the step's placeholder string until DEX-34 fills it in. */
  title: string;
};

/**
 * The steps of each ritual, in order, for a user with every step turned on.
 * Read through `stepsFor` rather than directly — `journal`, `calendar` and
 * `horoscope` each drop out when the user has that feature disabled. Most steps
 * still render a centered placeholder; later DEX-34 sub-issues replace them one
 * at a time in `components/RitualStepView.tsx`.
 *
 * **The morning ritual deliberately has no task-list step.** One was built
 * (DEX-144) and removed: a second copy of the Today list inside the ritual
 * duplicated the surface it was copying without being able to replace it — the
 * ritual is a sequence you walk once, the day's list is the thing you come back
 * to all day. `summary` closes the morning by counting the day and handing the
 * reader over to the real one instead (`components/SummaryStep.tsx`).
 */
export const RITUAL_STEPS: Record<TRitualMode, readonly TRitualStep[]> = {
  am: [
    { id: "horoscope", title: "Horoscope" },
    { id: "journal", title: "Journal" },
    { id: "calendar", title: "Calendar" },
    { id: "backlog", title: "Backlog" },
    { id: "summary", title: "Summary" },
  ],
  pm: [
    { id: "open-tasks", title: "Open tasks" },
    { id: "review", title: "Review" },
    { id: "journal", title: "Journal" },
    { id: "preview-tomorrow", title: "Preview tomorrow" },
    { id: "summary", title: "Summary" },
  ],
};

/**
 * The preferences that decide which steps a ritual has at all: the journal
 * (DEX-105) left the Today tab for the ritual, the calendar (DEX-140) only
 * appears for a user who has one, and the horoscope (DEX-142) is opt-out for
 * anyone who would rather not be walked through one — so a preference that used
 * to hide a day view now hides a step.
 */
export type TRitualStepToggles = {
  journalEnabled: boolean;
  calendarEnabled: boolean;
  horoscopeEnabled: boolean;
};

/**
 * Which toggle, if any, keeps each step. Ids absent from this table are
 * unconditional.
 *
 * A `Partial<Record<TRitualStepId, …>>` rather than a plain object literal, so
 * a mistyped id is a compile error rather than a step that silently never
 * drops.
 */
const STEP_TOGGLE: Partial<Record<TRitualStepId, keyof TRitualStepToggles>> = {
  journal: "journalEnabled",
  calendar: "calendarEnabled",
  horoscope: "horoscopeEnabled",
};

/**
 * One key per combination of the toggles above, spelled out as literals so
 * `STEP_LISTS` is an exhaustive `Record` — an `Object.fromEntries` build would
 * widen the key to `string` and let a missing combination through as
 * `undefined` at runtime.
 *
 * One character per toggle, in the order `journal`, `calendar`, `horoscope`;
 * a `-` is that toggle turned off. Every added toggle doubles this list, which
 * is the cost of the exhaustiveness above — worth paying while it stays legible
 * by eye, and the signal to reach for a lazy cache if it stops.
 */
const TOGGLE_KEYS = [
  "jch",
  "jc-",
  "j-h",
  "j--",
  "-ch",
  "-c-",
  "--h",
  "---",
] as const;
type TToggleKey = (typeof TOGGLE_KEYS)[number];

// The return annotation is the check that matters: TypeScript infers the
// template's own union of eight literals, so a key shape that drifted out of
// `TOGGLE_KEYS` would fail here rather than at a lookup returning `undefined`.
const toggleKey = (toggles: TRitualStepToggles): TToggleKey =>
  `${toggles.journalEnabled ? "j" : "-"}${
    toggles.calendarEnabled ? "c" : "-"
  }${toggles.horoscopeEnabled ? "h" : "-"}`;

const togglesForKey = (key: TToggleKey): TRitualStepToggles => ({
  journalEnabled: key[0] === "j",
  calendarEnabled: key[1] === "c",
  horoscopeEnabled: key[2] === "h",
});

const listsForMode = (
  mode: TRitualMode,
): Record<TToggleKey, readonly TRitualStep[]> => {
  const lists = {} as Record<TToggleKey, readonly TRitualStep[]>;
  for (const key of TOGGLE_KEYS) {
    const toggles = togglesForKey(key);
    lists[key] = RITUAL_STEPS[mode].filter((step) => {
      const toggle = STEP_TOGGLE[step.id];
      return toggle ? toggles[toggle] : true;
    });
  }
  return lists;
};

/**
 * Every ritual's step list, for every combination of the toggles.
 *
 * Precomputed rather than filtered per call so `stepsFor` returns one of
 * sixteen **stable** references: a fresh array on every render would defeat the
 * identity comparisons downstream (`ritualPageKey` aside, `ritualStepOptions`
 * maps it on every render of both switchers).
 *
 * The evening ritual has neither a calendar nor a horoscope step, so its eight
 * entries are distinct arrays holding only two distinct step lists — one per
 * journal setting. That is harmless — nothing compares lists across a
 * preference change, only across renders at the same settings — but worth
 * knowing before assuming identity implies content-equality here.
 */
const STEP_LISTS: Record<
  TRitualMode,
  Record<TToggleKey, readonly TRitualStep[]>
> = {
  am: listsForMode("am"),
  pm: listsForMode("pm"),
};

/** Noon is the boundary: before it the morning ritual, from it the evening one. */
export const modeForHour = (hour: number): TRitualMode =>
  hour < 12 ? "am" : "pm";

/**
 * The ritual that fits the time of day right now, in the device's timezone.
 *
 * Read live at the call site (inside a `useState` initializer), never frozen at
 * module load — the same rule the Week tab's `today` follows, and for the same
 * reason: an app left open across the boundary would otherwise keep the mode it
 * launched with.
 */
export const currentRitualMode = (): TRitualMode =>
  modeForHour(Temporal.Now.plainDateTimeISO().hour);

/** The mode the AM/PM button switches to. */
export const otherMode = (mode: TRitualMode): TRitualMode =>
  mode === "am" ? "pm" : "am";

/**
 * Everything a ritual surface needs to render, and nothing it doesn't.
 *
 * `journalEnabled` and `calendarEnabled` are `preferences.enableJournal` /
 * `preferences.enableCalendar`, mirrored into the state rather than read
 * alongside it.
 *
 * Two reasons they live here rather than being passed to each function below.
 * A state carrying the derived *list* instead would silently disagree with a
 * `{ ...state, mode }` override; and a `currentStep(state, prefs)` signature
 * would break during the render pass React runs with the **stale** state after
 * a set-state-during-render — it would index a six-step list with an index
 * bounded by a five-step one, hand `undefined` to `RitualStepView`, and throw
 * on `step.title`. Keeping the discriminators inside the state makes that pass
 * self-consistent.
 */
export type TRitualState = TRitualStepToggles & {
  date: Temporal.PlainDate;
  mode: TRitualMode;
  /** Index into `stepsFor(state)`. */
  step: number;
  /** Which way the last change travelled; drives `SwipeablePage`'s intro. */
  direction: -1 | 0 | 1;
};

/** The steps of the ritual on screen, minus any the user has turned off. */
export const stepsFor = (state: TRitualState): readonly TRitualStep[] =>
  STEP_LISTS[state.mode][toggleKey(state)];

/**
 * A fresh ritual: today's morning or evening flow, at its first step.
 *
 * The toggles arrive as an object rather than as more positional parameters:
 * they are the same type, so a transposed pair would be a silent bug rather
 * than a compile error. All default to on, matching `RITUAL_STEPS`.
 */
export const createRitualState = (
  date: Temporal.PlainDate = Temporal.Now.plainDateISO(),
  mode: TRitualMode = currentRitualMode(),
  toggles: Partial<TRitualStepToggles> = {},
): TRitualState => ({
  date,
  mode,
  step: 0,
  direction: 0,
  journalEnabled: toggles.journalEnabled ?? true,
  calendarEnabled: toggles.calendarEnabled ?? true,
  horoscopeEnabled: toggles.horoscopeEnabled ?? true,
});

/** The step on screen. */
export const currentStep = (state: TRitualState): TRitualStep =>
  stepsFor(state)[state.step];

export const isFirstStep = (state: TRitualState): boolean => state.step === 0;

export const isLastStep = (state: TRitualState): boolean =>
  state.step === stepsFor(state).length - 1;

/**
 * `SwipeablePage`'s remount key for the step on screen.
 *
 * All three parts matter: a step change plays the intro animation, and a date
 * or mode change restarts the ritual, which has to re-seed each step's content
 * the way a day change re-seeds Today's. Derived here rather than spelled out
 * at each layout, so the phone and the large screen cannot come to disagree
 * about what counts as a new page.
 */
export const ritualPageKey = (state: TRitualState): string =>
  `${state.date.toString()}-${state.mode}-${currentStep(state).id}`;

/**
 * Move one step forward or back.
 *
 * Returns the **same object** at either end rather than a clamped copy: an
 * identical state skips the re-render, and re-rendering would restart the
 * intro animation for a step change that never happened.
 */
export const advanceStep = (state: TRitualState, by: 1 | -1): TRitualState =>
  goToStep(state, state.step + by);

/**
 * Jump straight to a step — what the step switcher's menu rows and icons do.
 *
 * Out-of-range and already-there both return the **same object**, for the same
 * reason `advanceStep` clamps to one: a state that didn't change shouldn't
 * re-render and restart the intro animation. `direction` is derived from how
 * far the jump travelled, so picking a later step animates forward however many
 * it skips — the step-wise counterpart of what `withDate` does with
 * `Temporal.PlainDate.compare`.
 */
export const goToStep = (state: TRitualState, step: number): TRitualState => {
  // `Number.isInteger` first, because the range check alone does not reject
  // `NaN` — both of its comparisons are false for it, so a `NaN` would sail
  // through and land in `state.step`, where `currentStep` would return
  // `undefined` and every caller reading `step.id` would throw. The switcher
  // coerces a raw selection with `Number()` precisely because it might not be
  // one, so this is the other half of that guard.
  if (!Number.isInteger(step)) return state;
  if (step < 0 || step >= stepsFor(state).length) return state;
  const direction = Math.sign(step - state.step) as -1 | 0 | 1;
  if (direction === 0) return state;
  return { ...state, step, direction };
};

/**
 * Change the viewed day, **staying on the current step** (DEX-138).
 *
 * The step is the question being asked; the date only says which day's answer
 * is on screen. Someone who walked to Journal and then paged back a day is
 * comparing yesterday's journal to today's, and dropping them at Horoscope
 * makes them walk the whole ritual again to ask the same question — every day
 * they visit costs another lap. This is the same contract the Today tab keeps:
 * changing the day there leaves you on Tasks or Notes rather than resetting the
 * view.
 *
 * Carrying the index across is safe because a date change touches neither
 * `mode` nor any toggle, so `stepsFor` returns the very same list and the
 * index still means the step it meant. `withMode` resets to 0 precisely because
 * it *does* change that list.
 *
 * `direction` comes from `Temporal.PlainDate.compare` so a jump from the date
 * picker animates the way the calendar reads, however far it travels — the same
 * derivation `today/index.tsx` uses. The date is part of `ritualPageKey`, so
 * the page still remounts and re-seeds its content for the new day even though
 * the step index did not move.
 */
export const withDate = (
  state: TRitualState,
  date: Temporal.PlainDate,
): TRitualState => {
  const direction = Temporal.PlainDate.compare(date, state.date);
  // Picking the day already on screen is not a change: replaying the intro
  // animation for it would read as a flicker.
  if (direction === 0) return state;
  return { ...state, date, direction };
};

/**
 * Switch between the morning and evening ritual, restarting it.
 *
 * The two step lists differ in both length and content, so an index carried
 * across would land somewhere arbitrary. `direction` is assigned rather than
 * derived — AM→PM reads forward through the day and PM→AM back — because a
 * `0` would skip the intro animation entirely.
 */
export const withMode = (
  state: TRitualState,
  mode: TRitualMode,
): TRitualState => {
  if (mode === state.mode) return state;
  return { ...state, mode, step: 0, direction: mode === "pm" ? 1 : -1 };
};

/**
 * Re-point a toggled state at the step it was already on, found by **id** in
 * the list the toggle produced rather than by index: journal is index 1 of the
 * morning ritual and 2 of the evening one, so removing it shifts every later
 * step down. A plain clamp never fires for those (they're still in range) and
 * would silently move someone from Calendar to Backlog. Preserving the id also
 * leaves `ritualPageKey` unchanged, so `SwipeablePage` doesn't remount and
 * replay its intro for a toggle flipped in another tab.
 *
 * The clamp is only the fallback for the step that can actually vanish — the
 * one the toggle just removed, when the user was standing on it.
 */
const keepingStep = (state: TRitualState, next: TRitualState): TRitualState => {
  const id = currentStep(state).id;
  const steps = stepsFor(next);
  const index = steps.findIndex((step) => step.id === id);
  return {
    ...next,
    step: index === -1 ? Math.min(state.step, steps.length - 1) : index,
  };
};

/**
 * Follow a change to `preferences.enableJournal` while the ritual is on screen
 * — the settings toggle lives in another tab, and this one stays mounted.
 *
 * **The unchanged guard lives here, not in `keepingStep`.** `ritual/index.tsx`
 * sets state during render whenever the flag disagrees with preferences, so a
 * path that returned a state whose flag was *not* updated — tempting for the
 * evening ritual, where a calendar toggle changes no list — would leave that
 * comparison failing forever and spin the render loop.
 */
export const withJournalEnabled = (
  state: TRitualState,
  journalEnabled: boolean,
): TRitualState =>
  journalEnabled === state.journalEnabled
    ? state
    : keepingStep(state, { ...state, journalEnabled, direction: 0 });

/**
 * Follow a change to `preferences.enableCalendar` (DEX-140), the same way
 * `withJournalEnabled` follows the journal's.
 *
 * Runs in the *opposite* direction on a cold launch: the calendar preference
 * defaults to off, so an enabled user's ritual gains the step a moment after
 * mount rather than losing one. Keeping the step by id is what makes that
 * unremarkable — someone who opened straight onto Horoscope stays there.
 */
export const withCalendarEnabled = (
  state: TRitualState,
  calendarEnabled: boolean,
): TRitualState =>
  calendarEnabled === state.calendarEnabled
    ? state
    : keepingStep(state, { ...state, calendarEnabled, direction: 0 });

/**
 * Follow a change to `preferences.enableHoroscope` (DEX-142), the same way
 * `withJournalEnabled` follows the journal's.
 *
 * The horoscope is the morning ritual's **first** step, so it is the one toggle
 * whose step cannot be preserved by id when it goes: someone standing on it
 * falls to `keepingStep`'s clamp, which lands them on index 0 of the new list —
 * the step that now begins the ritual. Every other step keeps its identity, so
 * turning the horoscope off from another tab moves nobody who had already
 * walked past it.
 */
export const withHoroscopeEnabled = (
  state: TRitualState,
  horoscopeEnabled: boolean,
): TRitualState =>
  horoscopeEnabled === state.horoscopeEnabled
    ? state
    : keepingStep(state, { ...state, horoscopeEnabled, direction: 0 });

/**
 * Apply a deep link (`utils/ritualRoute.ts`) as **one** transition.
 *
 * Both parts land in a single state, so the screen never renders the link's
 * date against the pre-link step for a frame, and `direction` resolves once:
 * the step's travel wins when the link moves the step, and the date's remains
 * when it doesn't (`goToStep` returns its input for a step already on screen).
 * An unknown step id (a hand-edited URL, or `step: "journal"` for a user who
 * has the journal off) leaves the step alone rather than guessing — which,
 * since `withDate` now keeps the step (DEX-138), means a link carrying only a
 * date moves the day and stays put.
 */
export const withLink = (
  state: TRitualState,
  link: { date: Temporal.PlainDate | null; step: TRitualStepId | null },
): TRitualState => {
  const dated = link.date ? withDate(state, link.date) : state;
  if (!link.step) return dated;
  return goToStep(
    dated,
    stepsFor(dated).findIndex((step) => step.id === link.step),
  );
};

/**
 * The inset the ritual layouts place above a step, in `theme.space` units.
 *
 * Doubled on a large screen: a step that paints to its own edges — the
 * horoscope's card — reads as hanging off the toolbar at a matching inset once
 * `SwipeablePage` centers it inside its width cap (DEX-138).
 *
 * Stated here rather than inline in each layout because a third party needs it:
 * `HeroLines` matches it *below* the hero so the figures sit equally spaced
 * above and below, and a layout that quietly changed its own inset would tilt
 * every reporting step's hero without touching it. Takes the numbers rather
 * than a theme, keeping this module React- and import-free.
 */
export const ritualStepInsetTop = (
  space: { md: number },
  isLargeDevice: boolean,
): number => (isLargeDevice ? space.md * 2 : space.md);
