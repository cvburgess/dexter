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
