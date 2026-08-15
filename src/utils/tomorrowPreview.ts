import { Temporal } from "@js-temporal/polyfill";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";

/**
 * How tomorrow reads against a typical one of its own weekday: what the evening
 * ritual's Preview tomorrow step (DEX-149) says above the agenda.
 *
 * React-free and import-light, the same leaf discipline `calendarStats` keeps,
 * so every rule here — the comparison band, the no-history guard, and the whole
 * copy table — is unit-testable without a native host. The step resolves tones
 * to theme tokens and renders; it decides nothing.
 */

/**
 * How far from the average still counts as a typical day, as a fraction of it.
 *
 * Wide on purpose. A weekday's load is a handful of samples of a noisy quantity,
 * and a band tight enough to be statistically interesting would call almost
 * every day unusual — which is the same as saying nothing. At 30% the step only
 * speaks up when the difference is one a person would themselves notice.
 */
const COMPARABLE_BAND = 0.3;

/**
 * The four dates whose weekday matches `date` — last week's, and the three
 * before it.
 *
 * **A fixed-length tuple, and that is load-bearing rather than pedantic.** The
 * step reads each of these with its own `useCalendarEvents` call, so the count
 * has to be a constant the Rules of Hooks can see; typed as an array, a caller
 * could pass a length and break the step in a way nothing here would catch.
 *
 * Four weeks back also sits just inside the task fetch's *default* reach:
 * `DEFAULT_TASK_REACH_DAYS` is 30, and the oldest day this returns is 27 before
 * the ritual's own date — three days of slack, and no more. Lengthening this tuple
 * means raising that default too, or tonight's ritual silently drops the oldest
 * sample's completed tasks. (An old ritual date is covered instead by
 * `oldestDayRead` below, which the screen widens the reach to.)
 */
export type TWeekdayHistory = [
  Temporal.PlainDate,
  Temporal.PlainDate,
  Temporal.PlainDate,
  Temporal.PlainDate,
];

export const matchingWeekdaysBefore = (
  date: Temporal.PlainDate,
): TWeekdayHistory => [
  date.subtract({ weeks: 1 }),
  date.subtract({ weeks: 2 }),
  date.subtract({ weeks: 3 }),
  date.subtract({ weeks: 4 }),
];

/**
 * The oldest day a ritual on `date` reads tasks for — its own day is the newest,
 * and `matchingWeekdaysBefore` samples four weeks back from *tomorrow*.
 *
 * The Ritual screen widens the task fetch to this rather than to the day on
 * screen (DEX-162), so an old ritual's history samples are actually fetched
 * instead of counting as zero. Derived from the same tuple the step reads, so
 * the two cannot drift apart.
 */
export const oldestDayRead = (date: Temporal.PlainDate): Temporal.PlainDate =>
  matchingWeekdaysBefore(date.add({ days: 1 }))[3];

/** How one of tomorrow's figures sits against its own recent history. */
export type TLoad = "higher" | "lower" | "comparable";

/**
 * `value` against the average of `history`, inside a ±30% band.
 *
 * **An entirely empty history reads as comparable, not as higher.** Against a
 * zero average any figure at all is infinitely above it, so the arithmetic alone
 * would tell someone opening the app for the first time that tomorrow is busier
 * than a Thursday it has never seen. Treating "no evidence" as "nothing to say"
 * is the honest reading, and it resolves itself after a week of use.
 *
 * A history that is *partly* zero is real evidence and is averaged as-is — three
 * empty Thursdays and one with six tasks makes 1.5 the typical Thursday.
 */
export const compareToTypical = (value: number, history: number[]): TLoad => {
  const total = history.reduce((sum, entry) => sum + entry, 0);
  if (total === 0) return "comparable";

  const average = total / history.length;
  if (Math.abs(value - average) <= average * COMPARABLE_BAND) {
    return "comparable";
  }
  return value > average ? "higher" : "lower";
};

/**
 * A day's events in the order an agenda reads them: all-day first, then by start
 * time.
 *
 * All-day events lead because they frame the day rather than sit at a point in
 * it — a birthday is true of the whole Thursday, and slotting it at midnight
 * would bury it under the first standup. Copies rather than sorting in place;
 * the array belongs to a React Query cache.
 */
export const sortAgenda = (events: TCalendarEvent[]): TCalendarEvent[] =>
  [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return Temporal.PlainDateTime.compare(a.start, b.start);
  });

/**
 * A phrase's ink, named by what it means rather than by which color it takes —
 * the step maps these onto `colors.error` / `colors.success` / `colors.text`.
 * Kept as intent here so the whole copy table stays testable without a theme.
 */
export type TCopyTone = "plain" | "up" | "down";

export type TCopySegment = { text: string; tone: TCopyTone };

export type TTomorrowCopy = {
  /** The sentence, split where its ink changes. Concatenates to plain prose. */
  segments: TCopySegment[];
  /** The line under it, if this reading earns one. */
  followUp: string | null;
};

/** `more meetings` / `fewer tasks`, or nothing at all for a typical figure. */
const clause = (load: TLoad, noun: string): TCopySegment | null => {
  if (load === "comparable") return null;
  return {
    text: `${load === "higher" ? "more" : "fewer"} ${noun}`,
    tone: load === "higher" ? "up" : "down",
  };
};

/**
 * The hero sentence, from the two comparisons and tomorrow's weekday.
 *
 * **`events: null` means the reader has no calendar**, and it deliberately
 * behaves as `"comparable"` rather than as its own branch: a missing axis has
 * nothing to say, so the sentence falls through to whatever the task axis alone
 * reads as — the single-clause line when tasks are unusual, and the typical-day
 * line when they are not. That is exactly what the reader with no calendar
 * should see, out of the same table rather than a parallel one.
 *
 * Meetings lead the two-clause line because that is the axis a day is felt
 * along: what is already booked is what the reader cannot move.
 */
export const tomorrowCopy = (
  tasks: TLoad,
  events: TLoad | null,
  weekday: string,
): TTomorrowCopy => {
  const eventLoad: TLoad = events ?? "comparable";

  // `calmer` and `busier` carry the reading on their own, so they take the ink
  // the clauses below take — the whole sentence is the comparison here, where
  // the two-axis lines have a phrase per axis to mark instead.
  if (eventLoad === "lower" && tasks === "lower") {
    return {
      segments: [
        { text: "Tomorrow is ", tone: "plain" },
        { text: "calmer", tone: "down" },
        { text: ` than your typical ${weekday}.`, tone: "plain" },
      ],
      followUp: "Enjoy the extra space.",
    };
  }

  if (eventLoad === "higher" && tasks === "higher") {
    return {
      segments: [
        { text: "Tomorrow is ", tone: "plain" },
        { text: "busier", tone: "up" },
        { text: ` than your typical ${weekday}.`, tone: "plain" },
      ],
      followUp: "Don't forget to eat.",
    };
  }

  if (eventLoad === "comparable" && tasks === "comparable") {
    return {
      segments: [
        { text: `Tomorrow might be a typical ${weekday},`, tone: "plain" },
      ],
      followUp: "but you can make it extraordinary.",
    };
  }

  // What is left is one clause or two, and two only ever means one up and one
  // down — both-up and both-down were answered above.
  const clauses = [
    clause(eventLoad, "meetings"),
    clause(tasks, "tasks"),
  ].filter((segment): segment is TCopySegment => segment !== null);

  return {
    segments: [
      { text: "Tomorrow has ", tone: "plain" },
      ...(clauses.length === 2
        ? [clauses[0], { text: " but ", tone: "plain" as const }, clauses[1]]
        : clauses),
      { text: ` than your typical ${weekday}.`, tone: "plain" },
    ],
    followUp: null,
  };
};

/** The whole sentence as prose — the accessibility label for its colored spans. */
export const copyToText = (segments: TCopySegment[]): string =>
  segments.map((segment) => segment.text).join("");
