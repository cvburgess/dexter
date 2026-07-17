import { Temporal } from "@js-temporal/polyfill";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";

import {
  layoutEvents,
  nowLineTopPx,
  scrollOffsetForTarget,
} from "../calendarLayout";

const DATE = Temporal.PlainDate.from("2026-07-12");

const pdt = (day: number, hour: number, minute: number) =>
  new Temporal.PlainDateTime(2026, 7, day, hour, minute);

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
  start: pdt(12, startHour, startMin),
  end: pdt(12, endHour, endMin),
  allDay,
});

// Window 6:00 (360) → 20:00 (1200), 60px/hour.
const START = 360;
const END = 1200;
const HOUR = 60;

// `nowMinutes` defaults before the window so nothing reads as past unless a
// test opts in; `minHeight` keeps its previous meaning.
const layout = (
  events: TCalendarEvent[],
  minHeight?: number,
  nowMinutes = -Infinity,
) => layoutEvents(events, DATE, START, END, HOUR, nowMinutes, minHeight);

describe("layoutEvents", () => {
  it("positions an event by minutes from the window start", () => {
    const [positioned] = layout([event("a", 9, 0, 10, 0)]);
    expect(positioned.topPx).toBe(180); // (9:00 - 6:00) * 60px
    expect(positioned.heightPx).toBe(60); // 1 hour
  });

  it("drops all-day events (the timeline pins those separately)", () => {
    expect(layout([event("a", 0, 0, 0, 0, true)])).toHaveLength(0);
  });

  it("drops events entirely outside the window", () => {
    expect(layout([event("early", 4, 0, 5, 0)])).toHaveLength(0);
  });

  it("clamps an event that starts before the window", () => {
    const [positioned] = layout([event("spanning", 5, 0, 7, 0)]);
    expect(positioned.topPx).toBe(0);
    expect(positioned.heightPx).toBe(60); // clamped to 6:00 → 7:00
  });

  it("clamps an event that started the previous day into the window top", () => {
    // Yesterday 22:00 → today 08:00 (both sources return such cross-midnight
    // events). It must fill 06:00→08:00, not be dropped or shrunk to a sliver.
    const overnight: TCalendarEvent = {
      id: "overnight",
      title: "overnight",
      start: pdt(11, 22, 0),
      end: pdt(12, 8, 0),
      allDay: false,
    };
    const [positioned] = layout([overnight]);
    expect(positioned.topPx).toBe(0);
    expect(positioned.heightPx).toBe(120); // 06:00 → 08:00
  });

  it("clamps an event that ends the next day into the window bottom", () => {
    const late: TCalendarEvent = {
      id: "late",
      title: "late",
      start: pdt(12, 18, 0),
      end: pdt(13, 2, 0),
      allDay: false,
    };
    const [positioned] = layout([late]);
    expect(positioned.topPx).toBe(720); // (18:00 - 6:00) * 60
    expect(positioned.heightPx).toBe(120); // clamped to 18:00 → 20:00
  });

  it("enforces a minimum height for very short events", () => {
    const [positioned] = layout([event("quick", 9, 0, 9, 5)], 16);
    expect(positioned.heightPx).toBe(16);
  });

  it("splits overlapping events into side-by-side columns", () => {
    const result = layout([event("a", 9, 0, 10, 0), event("b", 9, 30, 10, 30)]);
    const a = result.find((r) => r.event.id === "a")!;
    const b = result.find((r) => r.event.id === "b")!;
    expect(a.columnCount).toBe(2);
    expect(b.columnCount).toBe(2);
    expect(new Set([a.columnIndex, b.columnIndex])).toEqual(new Set([0, 1]));
  });

  it("reuses a column once the earlier event has ended", () => {
    const result = layout([event("a", 9, 0, 10, 0), event("b", 10, 0, 11, 0)]);
    // Non-overlapping → each is its own single-column cluster.
    expect(result.every((r) => r.columnCount === 1)).toBe(true);
  });

  it("flags events ending at or before now as past", () => {
    // Now = 10:00 (600 min). "a" ends at 10:00, "b" ends at 11:00.
    const result = layout(
      [event("a", 9, 0, 10, 0), event("b", 10, 0, 11, 0)],
      undefined,
      600,
    );
    expect(result.find((r) => r.event.id === "a")!.isPast).toBe(true);
    expect(result.find((r) => r.event.id === "b")!.isPast).toBe(false);
  });

  it("marks every event past on a prior day (now is beyond midnight)", () => {
    // A day already elapsed → now is >1440 minutes past its midnight.
    const result = layout([event("a", 9, 0, 10, 0)], undefined, 2000);
    expect(result[0].isPast).toBe(true);
  });

  it("marks no event past on a future day (now is before its midnight)", () => {
    const result = layout([event("a", 9, 0, 10, 0)], undefined, -500);
    expect(result[0].isPast).toBe(false);
  });
});

describe("nowLineTopPx", () => {
  it("returns the pixel offset when now is inside the window", () => {
    expect(nowLineTopPx(600, START, END, HOUR)).toBe(240); // (600 - 360) * 1
  });

  it("returns 0 at the window start and the full height at the end", () => {
    expect(nowLineTopPx(START, START, END, HOUR)).toBe(0);
    expect(nowLineTopPx(END, START, END, HOUR)).toBe(840); // (1200 - 360) * 1
  });

  it("returns null when now is before or after the window", () => {
    expect(nowLineTopPx(START - 1, START, END, HOUR)).toBeNull();
    expect(nowLineTopPx(END + 1, START, END, HOUR)).toBeNull();
  });
});

describe("scrollOffsetForTarget", () => {
  // Content 1000px tall, viewport 300px → max scroll 700px.
  const VIEWPORT = 300;
  const CONTENT = 1000;

  it("anchors a mid-content target to the upper third of the viewport", () => {
    // 500 - 300/3 = 500 - 100 = 400.
    expect(scrollOffsetForTarget(500, VIEWPORT, CONTENT)).toBe(400);
  });

  it("clamps to 0 when the target is near the top (no negative scroll)", () => {
    // 50 - 100 = -50 → clamped to 0.
    expect(scrollOffsetForTarget(50, VIEWPORT, CONTENT)).toBe(0);
  });

  it("clamps to the max scroll when the target is near the bottom", () => {
    // 990 - 100 = 890, but max scroll is 700.
    expect(scrollOffsetForTarget(990, VIEWPORT, CONTENT)).toBe(700);
  });

  it("returns 0 when the content is shorter than the viewport", () => {
    expect(scrollOffsetForTarget(100, 500, 300)).toBe(0);
  });

  it("honors a custom anchor ratio", () => {
    // Centered: 500 - 300/2 = 350.
    expect(scrollOffsetForTarget(500, VIEWPORT, CONTENT, 1 / 2)).toBe(350);
  });
});
