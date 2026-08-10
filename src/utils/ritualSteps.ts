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
 * Every step's id, as a literal union.
 *
 * Spelled out rather than inferred so `components/RitualStepSwitcher.shared`'s
 * icon table is a `Record` over it and the compiler catches a step added here
 * without one. Some ids appear in both rituals (`journal`, `congrats`) — they
 * are the same step at a different time of day, so they share an icon.
 */
export type TRitualStepId =
  | "horoscope"
  | "journal"
  | "calendar"
  | "backlog"
  | "tasks"
  | "congrats"
  | "open-tasks"
  | "review"
  | "preview-tomorrow";

/** Every step id, for validating one that arrived from a route param. */
export const RITUAL_STEP_IDS: readonly TRitualStepId[] = [
  "horoscope",
  "journal",
  "calendar",
  "backlog",
  "tasks",
  "congrats",
  "open-tasks",
  "review",
  "preview-tomorrow",
];

export type TRitualStep = {
  /** Unique within its mode; part of the swipe pager's remount key. */
  id: TRitualStepId;
  /** Rendered as the step's placeholder string until DEX-34 fills it in. */
  title: string;
};

/**
 * The steps of each ritual, in order, for a user with every step turned on.
 * Read through `stepsFor` rather than directly — `journal` drops out when the
 * user has the journal disabled. Most steps still render a centered
 * placeholder; later DEX-34 sub-issues replace them one at a time in
 * `components/RitualStepView.tsx`.
 */
export const RITUAL_STEPS: Record<TRitualMode, readonly TRitualStep[]> = {
  am: [
    { id: "horoscope", title: "Horoscope" },
    { id: "journal", title: "Journal" },
    { id: "calendar", title: "Calendar" },
    { id: "backlog", title: "Backlog" },
    { id: "tasks", title: "Tasks" },
    { id: "congrats", title: "Congrats" },
  ],
  pm: [
    { id: "open-tasks", title: "Open tasks" },
    { id: "review", title: "Review" },
    { id: "journal", title: "Journal" },
    { id: "preview-tomorrow", title: "Preview tomorrow" },
    { id: "congrats", title: "Congrats" },
  ],
};

/**
 * The same lists with the journal step removed, for `enableJournal: false`
 * (DEX-105) — the journal left the Today tab for the ritual, so the preference
 * that used to hide a day view now hides a step.
 *
 * Precomputed rather than filtered per call so `stepsFor` returns one of four
 * **stable** references: a fresh array on every render would defeat the
 * identity comparisons downstream (`ritualPageKey` aside, `ritualStepOptions`
 * maps it on every render of both switchers).
 */
const JOURNAL_FREE_STEPS: Record<TRitualMode, readonly TRitualStep[]> = {
  am: RITUAL_STEPS.am.filter((step) => step.id !== "journal"),
  pm: RITUAL_STEPS.pm.filter((step) => step.id !== "journal"),
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

/** Everything a ritual surface needs to render, and nothing it doesn't. */
export type TRitualState = {
  date: Temporal.PlainDate;
  mode: TRitualMode;
  /** Index into `stepsFor(state)`. */
  step: number;
  /** Which way the last change travelled; drives `SwipeablePage`'s intro. */
  direction: -1 | 0 | 1;
  /**
   * `preferences.enableJournal`, mirrored into the state rather than read
   * alongside it.
   *
   * Two reasons it lives here rather than being passed to each function below.
   * A state carrying the derived *list* instead would silently disagree with a
   * `{ ...state, mode }` override; and a `currentStep(state, prefs)` signature
   * would break during the render pass React runs with the **stale** state
   * after a set-state-during-render — it would index a six-step list with an
   * index bounded by a five-step one, hand `undefined` to `RitualStepView`, and
   * throw on `step.title`. Keeping the discriminator inside the state makes
   * that pass self-consistent.
   */
  journalEnabled: boolean;
};

/** The steps of the ritual on screen, minus any the user has turned off. */
export const stepsFor = (state: TRitualState): readonly TRitualStep[] =>
  (state.journalEnabled ? RITUAL_STEPS : JOURNAL_FREE_STEPS)[state.mode];

/** A fresh ritual: today's morning or evening flow, at its first step. */
export const createRitualState = (
  date: Temporal.PlainDate = Temporal.Now.plainDateISO(),
  mode: TRitualMode = currentRitualMode(),
  journalEnabled = true,
): TRitualState => ({ date, mode, step: 0, direction: 0, journalEnabled });

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
 * Change the viewed day, restarting the ritual.
 *
 * A ritual belongs to its day, so carrying step 4 into another one is
 * meaningless. `direction` comes from `Temporal.PlainDate.compare` so a jump
 * from the date picker animates the way the calendar reads, however far it
 * travels — the same derivation `today/index.tsx` uses.
 */
export const withDate = (
  state: TRitualState,
  date: Temporal.PlainDate,
): TRitualState => {
  const direction = Temporal.PlainDate.compare(date, state.date);
  // Picking the day already on screen is not a change: restarting the step and
  // the animation for it would read as a flicker.
  if (direction === 0) return state;
  return { ...state, date, step: 0, direction };
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
 * Follow a change to `preferences.enableJournal` while the ritual is on screen
 * — the settings toggle lives in another tab, and this one stays mounted.
 *
 * Keeps the user on the **same step**, found by id in the new list rather than
 * by index: journal is index 1 of the morning ritual and 2 of the evening one,
 * so removing it shifts every later step down. A plain clamp never fires for
 * those (they're still in range) and would silently move someone from Calendar
 * to Backlog. Preserving the id also leaves `ritualPageKey` unchanged, so
 * `SwipeablePage` doesn't remount and replay its intro for a toggle flipped in
 * another tab.
 *
 * The clamp is only the fallback for the one step that can actually vanish —
 * the journal itself.
 */
export const withJournalEnabled = (
  state: TRitualState,
  journalEnabled: boolean,
): TRitualState => {
  if (journalEnabled === state.journalEnabled) return state;
  const id = currentStep(state).id;
  const next = { ...state, journalEnabled, direction: 0 as const };
  const steps = stepsFor(next);
  const index = steps.findIndex((step) => step.id === id);
  return {
    ...next,
    step: index === -1 ? Math.min(state.step, steps.length - 1) : index,
  };
};

/**
 * Apply a deep link (`utils/ritualRoute.ts`) as **one** transition.
 *
 * Ordering is the whole point of this living here rather than at the route:
 * `withDate` restarts the ritual at step 0, so a date and a step applied as two
 * separate updates would land on the date's first step, not the one asked for.
 * An unknown step id (a hand-edited URL, or `step: "journal"` for a user who
 * has the journal off) leaves the step alone rather than guessing.
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
