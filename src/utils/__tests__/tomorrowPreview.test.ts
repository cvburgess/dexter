import { Temporal } from "@js-temporal/polyfill";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";

import {
  compareToTypical,
  copyToText,
  matchingWeekdaysBefore,
  oldestDayRead,
  sortAgenda,
  tomorrowCopy,
} from "../tomorrowPreview";

// A Thursday, so the weekday the history has to land back on is a named one.
const THURSDAY = Temporal.PlainDate.from("2026-08-13");

const pdt = (day: number, hour: number, minute = 0) =>
  new Temporal.PlainDateTime(2026, 8, day, hour, minute);

const event = (
  id: string,
  start: Temporal.PlainDateTime,
  end: Temporal.PlainDateTime,
  allDay = false,
): TCalendarEvent => ({ id, title: id, start, end, allDay });

describe("matchingWeekdaysBefore", () => {
  it("walks back four weeks, landing on the same weekday each time", () => {
    const history = matchingWeekdaysBefore(THURSDAY);

    expect(history.map((date) => date.toString())).toEqual([
      "2026-08-06",
      "2026-07-30",
      "2026-07-23",
      "2026-07-16",
    ]);
    expect(history.every((date) => date.dayOfWeek === THURSDAY.dayOfWeek)).toBe(
      true,
    );
  });

  // The task fetch's default reach is 30 days back; the oldest sample has to fit
  // inside it.
  it("reaches no further back than 28 days", () => {
    const [, , , oldest] = matchingWeekdaysBefore(THURSDAY);

    expect(THURSDAY.since(oldest).total({ unit: "days" })).toBe(28);
  });
});

// What the Ritual screen widens the task fetch to, so an old ritual's history
// samples are fetched rather than counted as zero (DEX-162).
describe("oldestDayRead", () => {
  it("reaches back past the ritual's own date to the oldest history sample", () => {
    expect(oldestDayRead(THURSDAY).toString()).toBe("2026-07-17");
  });

  it("stays inside the default reach for tonight's ritual", () => {
    const back = THURSDAY.since(oldestDayRead(THURSDAY)).total({
      unit: "days",
    });

    expect(back).toBe(27);
    expect(back).toBeLessThan(30);
  });

  it("crosses a month and a leap-year February without drifting", () => {
    const leapDay = Temporal.PlainDate.from("2028-03-02");

    expect(matchingWeekdaysBefore(leapDay).map((d) => d.toString())).toEqual([
      "2028-02-24",
      "2028-02-17",
      "2028-02-10",
      "2028-02-03",
    ]);
  });
});

describe("compareToTypical", () => {
  // Average 10, so the band runs 7 through 13 inclusive.
  const history = [10, 10, 10, 10];

  it("calls a figure inside the band typical", () => {
    expect(compareToTypical(10, history)).toBe("comparable");
    expect(compareToTypical(8, history)).toBe("comparable");
    expect(compareToTypical(12, history)).toBe("comparable");
  });

  // Both edges are inclusive: exactly 30% off is the last figure that still
  // reads as typical, not the first that doesn't.
  it("includes both edges of the band", () => {
    expect(compareToTypical(13, history)).toBe("comparable");
    expect(compareToTypical(7, history)).toBe("comparable");
  });

  it("calls anything past the band higher or lower", () => {
    expect(compareToTypical(14, history)).toBe("higher");
    expect(compareToTypical(6, history)).toBe("lower");
  });

  // The guard the step leans on: with nothing to compare against, any figure at
  // all is infinitely above a zero average, and a first-time reader would be
  // told tomorrow is busier than a day the app has never seen.
  it("reads an entirely empty history as typical, whatever tomorrow holds", () => {
    expect(compareToTypical(9, [0, 0, 0, 0])).toBe("comparable");
    expect(compareToTypical(0, [0, 0, 0, 0])).toBe("comparable");
    expect(compareToTypical(9, [])).toBe("comparable");
  });

  // A partly-empty history is evidence, not an absence of it.
  it("averages a partly-empty history as-is", () => {
    // Average 1.5, band 1.05–1.95.
    expect(compareToTypical(6, [0, 0, 0, 6])).toBe("higher");
    expect(compareToTypical(0, [0, 0, 0, 6])).toBe("lower");
  });
});

describe("sortAgenda", () => {
  it("puts all-day events first, then orders the rest by start", () => {
    const standup = event("standup", pdt(13, 9), pdt(13, 9, 15));
    const review = event("review", pdt(13, 16), pdt(13, 17, 15));
    const birthday = event("birthday", pdt(13, 0), pdt(14, 0), true);

    expect(sortAgenda([review, standup, birthday]).map((e) => e.id)).toEqual([
      "birthday",
      "standup",
      "review",
    ]);
  });

  it("leaves its input alone", () => {
    const events = [
      event("late", pdt(13, 16), pdt(13, 17)),
      event("early", pdt(13, 9), pdt(13, 10)),
    ];
    sortAgenda(events);

    expect(events.map((e) => e.id)).toEqual(["late", "early"]);
  });
});

describe("tomorrowCopy", () => {
  const text = (
    tasks: Parameters<typeof tomorrowCopy>[0],
    events: Parameters<typeof tomorrowCopy>[1],
  ) => copyToText(tomorrowCopy(tasks, events, "Thursday").segments);

  it("calls a day that is lighter on both axes calmer", () => {
    const copy = tomorrowCopy("lower", "lower", "Thursday");

    expect(copyToText(copy.segments)).toBe(
      "Tomorrow is calmer than your typical Thursday.",
    );
    expect(copy.followUp).toBe("Enjoy the extra space.");
  });

  it("calls a day that is heavier on both axes busier", () => {
    const copy = tomorrowCopy("higher", "higher", "Thursday");

    expect(copyToText(copy.segments)).toBe(
      "Tomorrow is busier than your typical Thursday.",
    );
    expect(copy.followUp).toBe("Don't forget to eat.");
  });

  it("invites a typical day to be more than that", () => {
    const copy = tomorrowCopy("comparable", "comparable", "Thursday");

    expect(copyToText(copy.segments)).toBe(
      "Tomorrow might be a typical Thursday,",
    );
    expect(copy.followUp).toBe("but you can make it extraordinary.");
  });

  it("names both axes when they disagree, meetings first", () => {
    expect(text("lower", "higher")).toBe(
      "Tomorrow has more meetings but fewer tasks than your typical Thursday.",
    );
    expect(text("higher", "lower")).toBe(
      "Tomorrow has fewer meetings but more tasks than your typical Thursday.",
    );
  });

  it("names only the axis that is unusual", () => {
    expect(text("comparable", "higher")).toBe(
      "Tomorrow has more meetings than your typical Thursday.",
    );
    expect(text("lower", "comparable")).toBe(
      "Tomorrow has fewer tasks than your typical Thursday.",
    );
  });

  // The single word carries the whole reading on these two lines, so it takes
  // the ink the two-axis clauses take.
  it("marks calmer down and busier up", () => {
    expect(tomorrowCopy("lower", "lower", "Thursday").segments).toEqual([
      { text: "Tomorrow is ", tone: "plain" },
      { text: "calmer", tone: "down" },
      { text: " than your typical Thursday.", tone: "plain" },
    ]);
    expect(tomorrowCopy("higher", "higher", "Thursday").segments).toEqual([
      { text: "Tomorrow is ", tone: "plain" },
      { text: "busier", tone: "up" },
      { text: " than your typical Thursday.", tone: "plain" },
    ]);
  });

  // Nothing in a typical day is unusual, so nothing in it is marked.
  it("leaves a typical day entirely unmarked", () => {
    expect(
      tomorrowCopy("comparable", "comparable", "Thursday").segments.every(
        (segment) => segment.tone === "plain",
      ),
    ).toBe(true);
  });

  // The ink is the whole reason the sentence is segmented rather than a string.
  it("marks a heavier phrase up and a lighter one down, and nothing else", () => {
    expect(tomorrowCopy("lower", "higher", "Thursday").segments).toEqual([
      { text: "Tomorrow has ", tone: "plain" },
      { text: "more meetings", tone: "up" },
      { text: " but ", tone: "plain" },
      { text: "fewer tasks", tone: "down" },
      { text: " than your typical Thursday.", tone: "plain" },
    ]);
  });

  // A reader with no calendar has no meetings axis, and it must not become a
  // branch of its own — the task axis alone runs the same table.
  it("falls through to the task axis when there is no calendar", () => {
    expect(text("higher", null)).toBe(
      "Tomorrow has more tasks than your typical Thursday.",
    );
    expect(text("lower", null)).toBe(
      "Tomorrow has fewer tasks than your typical Thursday.",
    );

    const typical = tomorrowCopy("comparable", null, "Thursday");
    expect(copyToText(typical.segments)).toBe(
      "Tomorrow might be a typical Thursday,",
    );
    expect(typical.followUp).toBe("but you can make it extraordinary.");
  });

  it("never mentions meetings when there is no calendar", () => {
    expect(text("higher", null)).not.toContain("meetings");
  });
});
