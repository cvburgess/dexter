// Format times manually rather than via Intl/toLocaleTimeString: Hermes ships a
// partial Intl implementation, so @js-temporal/polyfill's locale formatting
// throws on native (see formatPlainDate.ts for the same constraint).

type THourMinute = { hour: number; minute: number };

/** e.g. "9:05 AM" / "12:00 PM" from any object exposing `hour`/`minute`. */
export const formatTime = ({ hour, minute }: THourMinute): string => {
  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
};

/** e.g. "9 AM" / "12 PM" — the compact label for a timeline hour gutter. */
export const formatHourLabel = (hour: number): string => {
  const normalized = ((hour % 24) + 24) % 24;
  const period = normalized < 12 ? "AM" : "PM";
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12} ${period}`;
};

/**
 * A span of minutes as a bare decimal count of hours — `"1"`, `"1.5"`,
 * `"1.25"`. **No unit**: the one caller is a `HeroLines` figure, where the unit
 * belongs to the words beside it (`1.5` + `hours planned`) so it takes the
 * words' ink rather than the figure's accent.
 *
 * Two decimal places at most, and never trailing zeros — `"1"` rather than
 * `"1.00"`, `"1.5"` rather than `"1.50"` — which is what `Number`'s own
 * stringification gives once the value is rounded, so there is no padding to
 * strip afterwards. This replaced an `"1h 30m"` format: hours and minutes made
 * two figures out of one quantity, which the hero's measured figure column
 * could not align and the eye could not compare against the line above.
 *
 * Negatives clamp to zero rather than being rejected: the callers derive these
 * from clock arithmetic, and `"-1.5"` would be a worse failure than `"0"`.
 */
export const formatHours = (minutes: number): string =>
  String(Math.round((Math.max(0, minutes) / 60) * 100) / 100);

/**
 * Parse a stored `"HH:MM:SS"` (or `"HH:MM"`) time-of-day into minutes past
 * midnight. Preferences persist the daily start/end as Postgres `time` strings.
 */
export const parseTimeToMinutes = (time: string): number => {
  const [hour = 0, minute = 0] = time
    .split(":")
    .map((part) => parseInt(part, 10));
  return (
    (Number.isFinite(hour) ? hour : 0) * 60 +
    (Number.isFinite(minute) ? minute : 0)
  );
};
