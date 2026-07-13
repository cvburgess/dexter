import { Temporal } from "@js-temporal/polyfill";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";

/** A timed event resolved to pixel offsets and an overlap column slot. */
export type TPositionedEvent = {
  event: TCalendarEvent;
  topPx: number;
  heightPx: number;
  /** 0-based column within its overlap cluster. */
  columnIndex: number;
  /** Total columns in this event's cluster (widths split evenly). */
  columnCount: number;
};

const MINUTES_PER_HOUR = 60;

/**
 * Minutes from the viewed day's midnight to `moment`. Signed and unbounded: an
 * event that starts the previous day is negative, one that ends the next day is
 * >1440. Computing from the date (not bare `hour`/`minute`) is what lets
 * cross-midnight and multi-day events clamp into the window correctly.
 */
const minutesFromDayStart = (
  moment: Temporal.PlainDateTime,
  dayStart: Temporal.PlainDateTime,
): number =>
  moment.since(dayStart, { largestUnit: "minute" }).total({ unit: "minute" });

/**
 * Resolve timed events into `{ topPx, heightPx, columnIndex, columnCount }` for
 * a single-day timeline (the viewed `date`) spanning `startMin`→`endMin`
 * (minutes past midnight) at `hourHeightPx` per hour.
 *
 * Events are clamped to the visible window (an event starting before `startMin`
 * — including on a prior day — begins at the top; one ending after `endMin` is
 * cut at the bottom); events entirely outside the window are dropped.
 * Overlapping events are packed into side-by-side columns: events are grouped
 * into clusters of transitive overlap, and within a cluster each event takes the
 * first column whose previous event has already ended. All events in a cluster
 * share the cluster's column count so their rendered widths line up.
 *
 * All-day events are ignored here — the timeline pins them in a separate header.
 */
export const layoutEvents = (
  events: TCalendarEvent[],
  date: Temporal.PlainDate,
  startMin: number,
  endMin: number,
  hourHeightPx: number,
  minEventHeightPx = 16,
): TPositionedEvent[] => {
  const pxPerMinute = hourHeightPx / MINUTES_PER_HOUR;
  const dayStart = date.toPlainDateTime();

  // Keep only timed events that intersect the visible window, sorted by start
  // then end so the greedy column packing is deterministic.
  const visible = events
    .filter((event) => !event.allDay)
    .map((event) => ({
      event,
      startMin: minutesFromDayStart(event.start, dayStart),
      endMin: minutesFromDayStart(event.end, dayStart),
    }))
    // Treat a zero/negative-length event as a short block so it stays visible.
    .map((e) =>
      e.endMin <= e.startMin ? { ...e, endMin: e.startMin + 15 } : e,
    )
    .filter((e) => e.endMin > startMin && e.startMin < endMin)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const positioned: TPositionedEvent[] = [];
  // A cluster is a maximal run of events where each overlaps the running span.
  let cluster: (typeof visible)[number][] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    // Greedy column assignment: reuse the earliest column that is free.
    const columnEnds: number[] = [];
    const assignments = cluster.map((item) => {
      let columnIndex = columnEnds.findIndex((end) => end <= item.startMin);
      if (columnIndex === -1) {
        columnIndex = columnEnds.length;
        columnEnds.push(item.endMin);
      } else {
        columnEnds[columnIndex] = item.endMin;
      }
      return { item, columnIndex };
    });
    const columnCount = columnEnds.length;

    for (const { item, columnIndex } of assignments) {
      const clampedStart = Math.max(item.startMin, startMin);
      const clampedEnd = Math.min(item.endMin, endMin);
      const topPx = (clampedStart - startMin) * pxPerMinute;
      const heightPx = Math.max(
        (clampedEnd - clampedStart) * pxPerMinute,
        minEventHeightPx,
      );
      positioned.push({
        event: item.event,
        topPx,
        heightPx,
        columnIndex,
        columnCount,
      });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of visible) {
    if (item.startMin >= clusterEnd) flushCluster();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flushCluster();

  return positioned;
};
