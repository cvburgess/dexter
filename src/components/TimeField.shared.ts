// The native time pickers (@expo/ui) work in JS `Date`, while the field's public
// API and the stored preference are `"HH:MM"` strings. These bridge the two.

/** Parse `"HH:MM"` into a `Date` today at that time. */
export const timeStringToDate = (value: string): Date => {
  const [hour = 0, minute = 0] = value
    .split(":")
    .map((part) => parseInt(part, 10));
  const date = new Date();
  date.setHours(
    Number.isFinite(hour) ? hour : 0,
    Number.isFinite(minute) ? minute : 0,
    0,
    0,
  );
  return date;
};

/** Format a `Date`'s time-of-day as `"HH:MM"`. */
export const dateToTimeString = (date: Date): string =>
  `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
