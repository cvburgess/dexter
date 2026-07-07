import { useResolvedColorScheme, useTheme } from "@/utils/theme";

import { TDateFieldProps } from "./DateField.types";

// `input[type="date"]` speaks "YYYY-MM-DD" in local time. Build and parse the
// string from local date parts (not `Date`'s UTC-based ISO output) so the value
// round-trips without a timezone shift.
const toInputValue = (date: Date): string => {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const fromInputValue = (value: string): Date | null => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

/**
 * Web implementation of the date field. The community `DateTimePicker` renders
 * nothing on web, so web gets the browser's native `input[type="date"]` — a
 * real calendar popover, themed to match via `accentColor`/`colorScheme`.
 */
export function DateField({
  accentColor,
  onChange,
  testID,
  value,
}: TDateFieldProps) {
  const theme = useTheme();
  const scheme = useResolvedColorScheme();

  return (
    <input
      type="date"
      data-testid={testID}
      value={toInputValue(value)}
      onChange={(event) => {
        // The field can be cleared to "", which we ignore — `DayNav` and the
        // task form always want a concrete date.
        const next = fromInputValue(event.target.value);
        if (next) onChange(next);
      }}
      style={{
        accentColor: accentColor ?? theme.colors.primary,
        background: "transparent",
        border: "none",
        color: theme.colors.text,
        colorScheme: scheme,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 16,
        fontWeight: 600,
      }}
    />
  );
}
