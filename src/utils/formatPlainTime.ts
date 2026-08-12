// Format times manually rather than via Intl/toLocaleTimeString: Hermes ships a
// partial Intl implementation, so @js-temporal/polyfill's locale formatting
// throws on native (see formatPlainDate.ts for the same constraint).

type THourMinute = { hour: number; minute: number };

/** e.g. "9:05" — the clock face, with no period on it. */
const formatClock = ({ hour, minute }: THourMinute): string => {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")}`;
};

const periodOf = ({ hour }: THourMinute): string => (hour < 12 ? "AM" : "PM");

/** e.g. "9:05 AM" / "12:00 PM" from any object exposing `hour`/`minute`. */
export const formatTime = (time: THourMinute): string =>
  `${formatClock(time)} ${periodOf(time)}`;

/**
 * An event's span, e.g. `"4:00-5:15 PM"` — the agenda row in the ritual's
 * Preview tomorrow step (DEX-149).
 *
 * **The period is stated once when both ends share it**, and on both ends when
 * they don't (`"11:30 AM-1:00 PM"`). Dropping it entirely is shorter still and
 * was the first cut, but `"4:00-5:15"` in a list a reader is scanning to plan
 * their morning is genuinely ambiguous — and the one place the ambiguity bites
 * is the one place an agenda has to be right. Repeating it on every row is the
 * other extreme: the row is already four elements wide, and "4:00 PM-5:15 PM"
 * spends its longest token saying the same thing twice.
 */
export const formatTimeRange = (
  start: THourMinute,
  end: THourMinute,
): string => {
  const startText =
    periodOf(start) === periodOf(end) ? formatClock(start) : formatTime(start);
  return `${startText}-${formatTime(end)}`;
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
