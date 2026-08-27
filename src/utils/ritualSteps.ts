import { Temporal } from "@js-temporal/polyfill";

/**
 * The Ritual flow's model (DEX-127), React- and import-free so it tests without
 * a native host. `state.step` indexes the *derived* `stepsFor` list — only the
 * transitions here may write it; the list can shrink under a mounted screen.
 */

/** Morning or evening ritual. */
export type TRitualMode = "am" | "pm";

/**
 * As values so `utils/ritualRoute.ts` can validate a route param; the union is
 * derived from it, so an id added to one cannot silently miss the other.
 */
export const RITUAL_STEP_IDS = [
  "breathe",
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
 * Enumerated so `RitualStepSwitcher.shared`'s icon table is a `Record` over it
 * and the compiler catches a step added without an icon.
 */
export type TRitualStepId = (typeof RITUAL_STEP_IDS)[number];

export type TRitualStep = {
  /** Unique within its mode; part of the swipe pager's remount key. */
  id: TRitualStepId;
  /** Rendered as the step's placeholder string until DEX-34 fills it in. */
  title: string;
};

/**
 * Read through `stepsFor`, never directly. The morning has no task-list step
 * (DEX-144 built one and removed it), `summary` is the morning's alone
 * (DEX-149), and the evening opens on `breathe` rather than a list (DEX-164).
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
    { id: "breathe", title: "Breathe" },
    { id: "open-tasks", title: "Open tasks" },
    { id: "review", title: "Review" },
    { id: "journal", title: "Journal" },
    { id: "preview-tomorrow", title: "Preview tomorrow" },
  ],
};

/**
 * The preferences that decide which steps exist: journal DEX-105, calendar
 * DEX-140, horoscope DEX-142 — preferences that used to hide day views.
 */
export type TRitualStepToggles = {
  journalEnabled: boolean;
  calendarEnabled: boolean;
  horoscopeEnabled: boolean;
};

/**
 * Ids absent here are unconditional. `Partial<Record<…>>` so a mistyped id is
 * a compile error rather than a step that silently never drops.
 */
const STEP_TOGGLE: Partial<Record<TRitualStepId, keyof TRitualStepToggles>> = {
  journal: "journalEnabled",
  calendar: "calendarEnabled",
  horoscope: "horoscopeEnabled",
};

/**
 * Literal keys keep `STEP_LISTS` an exhaustive `Record` (`Object.fromEntries`
 * widens to `string`). One char per toggle, `j`/`c`/`h` order, `-` = off;
 * every added toggle doubles this list.
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

// The return annotation is the check: a key shape drifting out of
// `TOGGLE_KEYS` fails here rather than at a lookup returning `undefined`.
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
 * Precomputed so `stepsFor` returns stable references — a fresh array per call
 * would defeat the identity comparisons downstream. Distinct entries can hold
 * equal content (pm ignores two toggles), so identity ≠ content-equality.
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
 * Read live at the call site, never frozen at module load — an app left open
 * across noon would otherwise keep the mode it launched with.
 */
export const currentRitualMode = (): TRitualMode =>
  modeForHour(Temporal.Now.plainDateTimeISO().hour);

/** The mode the AM/PM button switches to. */
export const otherMode = (mode: TRitualMode): TRitualMode =>
  mode === "am" ? "pm" : "am";

/**
 * The toggles are mirrored into the state, not read beside it: React's stale
 * render pass after a set-state-during-render must stay self-consistent — a
 * `currentStep(state, prefs)` split would over-index the list and throw.
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
 * A fresh ritual at its first step. Toggles arrive as an object — positional
 * booleans would make a transposed pair a silent bug. All default to on.
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
 * `SwipeablePage`'s remount key — all three parts matter. Derived once so the
 * phone and large-screen layouts can't disagree about what counts as a page.
 */
export const ritualPageKey = (state: TRitualState): string =>
  `${state.date.toString()}-${state.mode}-${currentStep(state).id}`;

/**
 * Returns the **same object** at either end rather than a clamped copy — a
 * re-render would restart the intro for a step change that never happened.
 */
export const advanceStep = (state: TRitualState, by: 1 | -1): TRitualState =>
  goToStep(state, state.step + by);

/**
 * Out-of-range and already-there both return the **same object** (see
 * `advanceStep`); `direction` derives from the travel, so skips animate.
 */
export const goToStep = (state: TRitualState, step: number): TRitualState => {
  // The range check alone passes NaN (both comparisons false) into
  // `state.step`; the switcher coerces raw selections with `Number()`.
  if (!Number.isInteger(step)) return state;
  if (step < 0 || step >= stepsFor(state).length) return state;
  const direction = Math.sign(step - state.step) as -1 | 0 | 1;
  if (direction === 0) return state;
  return { ...state, step, direction };
};

/**
 * Change the day, **staying on the current step** (DEX-138) — the Today tab's
 * contract. Carrying the index is safe only because a date change cannot alter
 * `stepsFor`'s list; the date is in `ritualPageKey`, so the page still remounts.
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
 * Restarts at step 0: the two lists differ, so a carried index lands anywhere.
 * `direction` is assigned (AM→PM forward) — a derived 0 would skip the intro.
 */
export const withMode = (
  state: TRitualState,
  mode: TRitualMode,
): TRitualState => {
  if (mode === state.mode) return state;
  return { ...state, mode, step: 0, direction: mode === "pm" ? 1 : -1 };
};

/**
 * Re-points by **id**, not index: removing a step shifts later ones down, and
 * a clamp never fires for in-range indexes — it would silently move someone
 * from Calendar to Backlog. The clamp is only for the step the toggle removed.
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
 * Follows `preferences.enableJournal` under a mounted screen. The flag must
 * always be written: `ritual/index.tsx` sets state during render whenever it
 * disagrees with preferences, and an un-updated flag would spin that loop.
 */
export const withJournalEnabled = (
  state: TRitualState,
  journalEnabled: boolean,
): TRitualState =>
  journalEnabled === state.journalEnabled
    ? state
    : keepingStep(state, { ...state, journalEnabled, direction: 0 });

/**
 * DEX-140, like `withJournalEnabled`. Also runs in reverse on cold launch —
 * the preference defaults off, so the ritual *gains* the step after mount.
 */
export const withCalendarEnabled = (
  state: TRitualState,
  calendarEnabled: boolean,
): TRitualState =>
  calendarEnabled === state.calendarEnabled
    ? state
    : keepingStep(state, { ...state, calendarEnabled, direction: 0 });

/**
 * DEX-142, like `withJournalEnabled`. Horoscope is the morning's **first**
 * step, so removal can't preserve id — the clamp lands on the new index 0.
 */
export const withHoroscopeEnabled = (
  state: TRitualState,
  horoscopeEnabled: boolean,
): TRitualState =>
  horoscopeEnabled === state.horoscopeEnabled
    ? state
    : keepingStep(state, { ...state, horoscopeEnabled, direction: 0 });

/**
 * Applies a deep link as **one** transition, so the screen never renders the
 * link's date against the pre-link step. An unknown or disabled step id leaves
 * the step alone; a date-only link moves the day and stays put (DEX-138).
 */
export const withLink = (
  state: TRitualState,
  link: {
    date: Temporal.PlainDate | null;
    /** Optional, and usually absent — see `utils/ritualRoute.ts`. */
    mode?: TRitualMode | null;
    step: TRitualStepId | null;
  },
): TRitualState => {
  const dated = link.date ? withDate(state, link.date) : state;
  // Mode before step, never after: `withMode` restarts at step 0 and would
  // throw away the step the link asked for. Ordering stated once, here.
  const moded = link.mode ? withMode(dated, link.mode) : dated;
  if (!link.step) return moded;
  return goToStep(
    moded,
    stepsFor(moded).findIndex((step) => step.id === link.step),
  );
};

/**
 * The inset above a step, doubled on large screens (DEX-138). Stated once
 * because `HeroLines` must match it below the hero; takes bare numbers to
 * keep this module import-free.
 */
export const ritualStepInsetTop = (
  space: { md: number },
  isLargeDevice: boolean,
): number => (isLargeDevice ? space.md * 2 : space.md);
