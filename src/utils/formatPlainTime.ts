// Manual formatting, not Intl: Hermes ships a partial Intl, so the polyfill's
// locale formatting throws on native (see formatPlainDate.ts).

type THourMinute = { hour: number; minute: number };

/** e.g. "9:05" (or "21:05" on a 24h clock) — the clock face, no period. */
const formatClock = (
  { hour, minute }: THourMinute,
  uses24HourClock: boolean,
): string => {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const shownHour = uses24HourClock ? hour : hour12;
  return `${shownHour}:${minute.toString().padStart(2, "0")}`;
};

const periodOf = ({ hour }: THourMinute): string => (hour < 12 ? "AM" : "PM");

/** e.g. "9:05 AM" / "12:00 PM", or "21:05" on a 24h clock. */
export const formatTime = (
  time: THourMinute,
  uses24HourClock: boolean,
): string =>
  uses24HourClock
    ? formatClock(time, true)
    : `${formatClock(time, false)} ${periodOf(time)}`;

/**
 * e.g. `"4:00-5:15 PM"` (DEX-149). Period stated once when shared, else on both
 * ends — dropping it entirely made agenda rows genuinely ambiguous.
 */
export const formatTimeRange = (
  start: THourMinute,
  end: THourMinute,
  uses24HourClock: boolean,
): string => {
  const startText =
    uses24HourClock || periodOf(start) === periodOf(end)
      ? formatClock(start, uses24HourClock)
      : formatTime(start, false);
  return `${startText}-${formatTime(end, uses24HourClock)}`;
};

/** e.g. "9 AM" / "12 PM", or "9:00" on a 24h clock — the hour-gutter label. */
export const formatHourLabel = (
  hour: number,
  uses24HourClock: boolean,
): string => {
  const normalized = ((hour % 24) + 24) % 24;
  if (uses24HourClock) return `${normalized}:00`;
  const period = normalized < 12 ? "AM" : "PM";
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12} ${period}`;
};

/**
 * Minutes as bare decimal hours ("1.5") — the unit lives in the words beside
 * the HeroLines figure. Negatives from clock arithmetic clamp to "0".
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
