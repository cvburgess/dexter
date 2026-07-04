import { Temporal } from "@js-temporal/polyfill";

// Hermes's built-in Intl.DateTimeFormat is a partial implementation (no
// `calendar` in resolvedOptions()), which makes @js-temporal/polyfill's
// toLocaleString throw "Missing internal slot calendar-id" on native. Format
// manually instead of depending on Intl completeness.
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

/** e.g. "Aug 15, 2026" */
export const formatMonthDayYear = (date: Temporal.PlainDate) =>
  `${MONTHS[date.month - 1]} ${date.day}, ${date.year}`;
