import { Temporal } from "@js-temporal/polyfill";

/**
 * How long until the calendar day changes — the delay `useToday`'s watcher arms
 * its timer with (DEX-161).
 *
 * Takes the moment rather than reading the clock so a test can pin one, and a
 * **`ZonedDateTime`** rather than a `PlainDateTime` because the answer is an
 * elapsed duration, not a wall-clock difference: on the two DST days a year the
 * two disagree by an hour, and `startOfDay` is also the only thing that gets a
 * midnight that doesn't exist right (Brazil used to skip it entirely).
 */
export const msUntilNextDay = (now: Temporal.ZonedDateTime): number => {
  const nextDay = now.add({ days: 1 }).startOfDay();

  return (
    now.until(nextDay).total({ unit: "millisecond" }) +
    // A whole second past the boundary rather than exactly on it: a timer that
    // fires a tick early reads the *old* day, publishes nothing, and re-arms
    // for the handful of milliseconds it was short by. Being a second late
    // costs nothing — the app is asleep at midnight, and the foreground pass
    // covers the case where it isn't.
    1000
  );
};
