import { Temporal } from "@js-temporal/polyfill";

import { firstParam, type TRouteParam } from "@/utils/todayRoute";

/**
 * The Ritual flow's model (DEX-127): which steps exist, which half of the day
 * they belong to, and every transition between them.
 *
 * Deliberately React-free so the whole rule set is unit-testable without a
 * native host — the same split `dayViewOptions` uses in `DayViewSwitcher`. The
 * screens (`ritual/index.tsx`, `ritual-session.tsx`) hold one `TRitualState`
 * each and do nothing but hand it to the transitions below.
 */

/** Morning or evening ritual. */
export type TRitualMode = "am" | "pm";

export type TRitualStep = {
  /** Unique within its mode; part of the swipe pager's remount key. */
  id: string;
  /** Rendered as the step's placeholder string until DEX-34 fills it in. */
  title: string;
};

/**
 * The steps of each ritual, in order. Every one renders a centered placeholder
 * for now; later DEX-34 sub-issues replace them one at a time in
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

/** The requested mode, or null when absent or unrecognized. */
export const parseRitualMode = (value: TRouteParam): TRitualMode | null => {
  const mode = firstParam(value);
  return mode === "am" || mode === "pm" ? mode : null;
};

/** Everything a ritual surface needs to render, and nothing it doesn't. */
export type TRitualState = {
  date: Temporal.PlainDate;
  mode: TRitualMode;
  /** Index into `RITUAL_STEPS[mode]`. */
  step: number;
  /** Which way the last change travelled; drives `SwipeablePage`'s intro. */
  direction: -1 | 0 | 1;
};

/** A fresh ritual: today's morning or evening flow, at its first step. */
export const createRitualState = (
  date: Temporal.PlainDate = Temporal.Now.plainDateISO(),
  mode: TRitualMode = currentRitualMode(),
): TRitualState => ({ date, mode, step: 0, direction: 0 });

/** The step on screen. */
export const currentStep = (state: TRitualState): TRitualStep =>
  RITUAL_STEPS[state.mode][state.step];

export const isFirstStep = (state: TRitualState): boolean => state.step === 0;

export const isLastStep = (state: TRitualState): boolean =>
  state.step === RITUAL_STEPS[state.mode].length - 1;

/**
 * Move one step forward or back.
 *
 * Returns the **same object** at either end rather than a clamped copy: an
 * identical state skips the re-render, and re-rendering would restart the
 * intro animation for a step change that never happened.
 */
export const advanceStep = (state: TRitualState, by: 1 | -1): TRitualState => {
  const step = state.step + by;
  if (step < 0 || step >= RITUAL_STEPS[state.mode].length) return state;
  return { ...state, step, direction: by };
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
