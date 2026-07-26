import { Temporal } from "@js-temporal/polyfill";

/**
 * The date pickers (`components/DateField.*`) speak the platform's native
 * `Date`; everything else in the app speaks `Temporal.PlainDate` or an ISO
 * `"YYYY-MM-DD"` string. These convert at that boundary.
 *
 * Always through the *local* calendar fields, never by parsing the ISO string
 * directly: `new Date("2026-07-26")` is read as UTC midnight, which lands on
 * the day before anywhere west of Greenwich.
 */

/** `Temporal.PlainDate` → a `Date` at local midnight on the same day. */
export const plainDateToDate = (date: Temporal.PlainDate): Date =>
  new Date(date.year, date.month - 1, date.day);

/** `Date` → the `Temporal.PlainDate` for its local calendar day. */
export const dateToPlainDate = (date: Date): Temporal.PlainDate =>
  Temporal.PlainDate.from({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });

/** `"YYYY-MM-DD"` → a `Date` at local midnight on that day. */
export const plainDateISOToDate = (iso: string): Date =>
  plainDateToDate(Temporal.PlainDate.from(iso));

/** `Date` → the `"YYYY-MM-DD"` string for its local calendar day. */
export const dateToPlainDateISO = (date: Date): string =>
  dateToPlainDate(date).toString();
