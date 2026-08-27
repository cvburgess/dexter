import { Temporal } from "@js-temporal/polyfill";

/** Monday-first, matching the rest of the app. Anchored on an arbitrary date
 * rather than today, letting the Week tab (DEX-96) page by whole weeks. */
export const weekOf = (date: Temporal.PlainDate) => {
  // `dayOfWeek` is 1 (Monday) through 7 (Sunday), so subtracting one less than
  // it lands on that week's Monday — and on zero days when already there.
  const monday = date.subtract({ days: date.dayOfWeek - 1 });
  return { monday, sunday: monday.add({ days: 6 }) };
};

/** The seven days of the week starting at `monday`, in order. */
export const weekDays = (monday: Temporal.PlainDate): Temporal.PlainDate[] =>
  Array.from({ length: 7 }, (_, index) => monday.add({ days: index }));

/** The today-relative form of `weekOf`, used by `MoreMenu`'s "Next Week" preset. */
export const weekStartEnd = (weeksOffset = 0) =>
  weekOf(Temporal.Now.plainDateISO().add({ weeks: weeksOffset }));
