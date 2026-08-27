import { Temporal } from "@js-temporal/polyfill";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";

// What the evening ritual's Preview tomorrow step (DEX-149) says above the
// agenda. React-free like calendarStats — the step resolves tones and renders.

// Wide on purpose: a weekday's load is a few noisy samples, and a tighter
// band would call almost every day unusual.
const COMPARABLE_BAND = 0.3;

// Fixed length, load-bearing: each is read via its own useCalendarEvents
// call, so the count must be a Rules-of-Hooks constant.
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

// The Ritual screen widens the task fetch to this, not to the day on screen
// (DEX-162), so an old ritual's history samples are fetched, not zero.
export const oldestDayRead = (date: Temporal.PlainDate): Temporal.PlainDate =>
  matchingWeekdaysBefore(date.add({ days: 1 }))[3];

/** How one of tomorrow's figures sits against its own recent history. */
export type TLoad = "higher" | "lower" | "comparable";

// An entirely empty history reads as comparable — against a zero average any
// figure is infinitely above it; a partly-empty history averages as-is.
export const compareToTypical = (value: number, history: number[]): TLoad => {
  const total = history.reduce((sum, entry) => sum + entry, 0);
  if (total === 0) return "comparable";

  const average = total / history.length;
  if (Math.abs(value - average) <= average * COMPARABLE_BAND) {
    return "comparable";
  }
  return value > average ? "higher" : "lower";
};

// All-day events lead because they frame the day rather than sit at a point
// in it. Copies rather than sorting in place — the array belongs to a cache.
export const sortAgenda = (events: TCalendarEvent[]): TCalendarEvent[] =>
  [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return Temporal.PlainDateTime.compare(a.start, b.start);
  });

// Named by meaning, not color — the step maps these onto theme tokens, which
// keeps the copy table testable without one.
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

// `events: null` means no calendar; it behaves as "comparable" rather than
// its own branch, so the sentence falls through to the task axis alone.
export const tomorrowCopy = (
  tasks: TLoad,
  events: TLoad | null,
  weekday: string,
): TTomorrowCopy => {
  const eventLoad: TLoad = events ?? "comparable";

  // "calmer"/"busier" carry the whole reading here, so they take the ink the
  // two-axis clauses take below.
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

  // One clause or two; two only ever means one up and one down.
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
