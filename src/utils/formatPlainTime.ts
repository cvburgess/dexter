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
 * A span of minutes as "2h", "45m" or "1h 30m" — a zero part is dropped rather
 * than written out, so an exact hour reads as "1h". A total of zero has no part
 * left to drop and falls back to "0h", which keeps it the same shape as the
 * figure it sits beside ("0h free" under "14h planned").
 *
 * Negative and fractional inputs are floored and rounded rather than rejected:
 * the callers derive these from clock arithmetic, and "-1h 59m" would be a
 * worse failure than "0h".
 */
export const formatDuration = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (hours === 0 && remainder === 0) return "0h";
  if (remainder === 0) return `${hours}h`;
  if (hours === 0) return `${remainder}m`;
  return `${hours}h ${remainder}m`;
};

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
