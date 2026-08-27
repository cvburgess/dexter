import { Temporal } from "@js-temporal/polyfill";

// Always via local calendar fields — parsing the ISO string directly reads
// as UTC midnight, landing a day early west of Greenwich.

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
