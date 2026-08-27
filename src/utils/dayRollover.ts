import { Temporal } from "@js-temporal/polyfill";

/** The delay `useToday`'s watcher arms its timer with (DEX-161). `ZonedDateTime`,
 * not `PlainDateTime`: on DST days a wall-clock diff is off by an hour. */
export const msUntilNextDay = (now: Temporal.ZonedDateTime): number => {
  const nextDay = now.add({ days: 1 }).startOfDay();

  return (
    now.until(nextDay).total({ unit: "millisecond" }) +
    // A second past the boundary, not exactly on it: firing early re-reads the
    // old day and re-arms for milliseconds; a second late costs nothing.
    1000
  );
};
