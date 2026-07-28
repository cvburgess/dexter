import { Temporal } from "@js-temporal/polyfill";

/**
 * The Monday–Sunday week containing `date`. Monday-first throughout, matching
 * the rest of the app (`WeekdayPicker`, `formatPlainDate`'s `WEEKDAYS`).
 *
 * Anchored on an arbitrary date rather than on today, which is what lets the
 * Week tab (DEX-96) page by adding/subtracting whole weeks from whichever week
 * is on screen. `weekStartEnd` below is the today-relative form.
 */
export const weekOf = (date: Temporal.PlainDate) => {
  // `dayOfWeek` is 1 (Monday) through 7 (Sunday), so subtracting one less than
  // it lands on that week's Monday — and on zero days when already there.
  const monday = date.subtract({ days: date.dayOfWeek - 1 });
  return { monday, sunday: monday.add({ days: 6 }) };
};

/** The seven days of the week starting at `monday`, in order. */
export const weekDays = (monday: Temporal.PlainDate): Temporal.PlainDate[] =>
  Array.from({ length: 7 }, (_, index) => monday.add({ days: index }));

/**
 * The Monday–Sunday week `weeksOffset` weeks from the current one — the
 * today-relative form of `weekOf`, used by `MoreMenu`'s "Next Week" schedule
 * preset.
 */
export const weekStartEnd = (weeksOffset = 0) =>
  weekOf(Temporal.Now.plainDateISO().add({ weeks: weeksOffset }));
