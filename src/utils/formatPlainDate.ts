import { Temporal } from "@js-temporal/polyfill";

// Hermes's Intl.DateTimeFormat is partial (no `calendar` in
// resolvedOptions()), so the polyfill's toLocaleString throws on native.
const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** e.g. "Friday, Jul 3" */
export const formatWeekdayMonthDay = (date: Temporal.PlainDate) =>
  `${WEEKDAYS[date.dayOfWeek - 1]}, ${MONTHS[date.month - 1]} ${date.day}`;

/** e.g. "Wednesday" — the Week tab's column titles (DEX-96). */
export const formatWeekday = (date: Temporal.PlainDate) =>
  WEEKDAYS[date.dayOfWeek - 1];

/** e.g. "7/3" — Week's column subtitles, unpadded like the legacy app's. */
export const formatMonthDay = (date: Temporal.PlainDate) =>
  `${date.month}/${date.day}`;

/** e.g. "Aug 15, 2026" */
export const formatMonthDayYear = (date: Temporal.PlainDate) =>
  `${MONTHS[date.month - 1]} ${date.day}, ${date.year}`;
