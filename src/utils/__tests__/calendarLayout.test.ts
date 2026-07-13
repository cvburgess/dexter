import { Temporal } from "@js-temporal/polyfill";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";

import { layoutEvents } from "../calendarLayout";

const pdt = (hour: number, minute: number) =>
  new Temporal.PlainDateTime(2026, 7, 12, hour, minute);

const event = (
  id: string,
  startHour: number,
  startMin: number,
  endHour: number,
  endMin: number,
  allDay = false,
): TCalendarEvent => ({
  id,
  title: id,
  start: pdt(startHour, startMin),
  end: pdt(endHour, endMin),
  allDay,
});

// Window 6:00 (360) → 20:00 (1200), 60px/hour.
const START = 360;
const END = 1200;
const HOUR = 60;

describe("layoutEvents", () => {
  it("positions an event by minutes from the window start", () => {
    const [positioned] = layoutEvents(
      [event("a", 9, 0, 10, 0)],
      START,
      END,
      HOUR,
    );
    expect(positioned.topPx).toBe(180); // (9:00 - 6:00) * 60px
    expect(positioned.heightPx).toBe(60); // 1 hour
  });

  it("drops all-day events (the timeline pins those separately)", () => {
    expect(
      layoutEvents([event("a", 0, 0, 0, 0, true)], START, END, HOUR),
    ).toHaveLength(0);
  });

  it("drops events entirely outside the window", () => {
    expect(
      layoutEvents([event("early", 4, 0, 5, 0)], START, END, HOUR),
    ).toHaveLength(0);
  });

  it("clamps an event that starts before the window", () => {
    const [positioned] = layoutEvents(
      [event("spanning", 5, 0, 7, 0)],
      START,
      END,
      HOUR,
    );
    expect(positioned.topPx).toBe(0);
    expect(positioned.heightPx).toBe(60); // clamped to 6:00 → 7:00
  });

  it("enforces a minimum height for very short events", () => {
    const [positioned] = layoutEvents(
      [event("quick", 9, 0, 9, 5)],
      START,
      END,
      HOUR,
      16,
    );
    expect(positioned.heightPx).toBe(16);
  });

  it("splits overlapping events into side-by-side columns", () => {
    const result = layoutEvents(
      [event("a", 9, 0, 10, 0), event("b", 9, 30, 10, 30)],
      START,
      END,
      HOUR,
    );
    const a = result.find((r) => r.event.id === "a")!;
    const b = result.find((r) => r.event.id === "b")!;
    expect(a.columnCount).toBe(2);
    expect(b.columnCount).toBe(2);
    expect(new Set([a.columnIndex, b.columnIndex])).toEqual(new Set([0, 1]));
  });

  it("reuses a column once the earlier event has ended", () => {
    const result = layoutEvents(
      [event("a", 9, 0, 10, 0), event("b", 10, 0, 11, 0)],
      START,
      END,
      HOUR,
    );
    // Non-overlapping → each is its own single-column cluster.
    expect(result.every((r) => r.columnCount === 1)).toBe(true);
  });
});
