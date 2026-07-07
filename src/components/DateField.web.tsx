import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { formatWeekdayMonthDay } from "@/utils/formatPlainDate";
import { useTheme, withOpacity } from "@/utils/theme";

import { TDateFieldProps } from "./DateField.types";

const toPlainDate = (date: Date): Temporal.PlainDate =>
  Temporal.PlainDate.from({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });

/**
 * Web implementation of the date field. The community `DateTimePicker` renders
 * nothing on web and the browser's native `input[type="date"]` can't match our
 * label styling, so — following the legacy dexter-app's `ButtonWithPopover` —
 * web renders the date as a plain button that opens a themed `react-day-picker`
 * calendar. The trigger uses the same `"Weekday, Mon D"` format as the rest of
 * the app, and the calendar is themed from `useTheme` (daisyUI tokens in the
 * legacy app map to our theme colors here).
 */
export function DateField({
  accentColor,
  onChange,
  testID,
  value,
}: TDateFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const accent = accentColor ?? theme.colors.primary;

  const calendarVars = {
    "--rdp-accent-color": accent,
    "--rdp-accent-background-color": withOpacity(accent, 0.15),
    "--rdp-today-color": accent,
    "--rdp-day-width": "36px",
    "--rdp-day-height": "36px",
    margin: 0,
    color: theme.colors.text,
  } as React.CSSProperties;

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        data-testid={testID}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          background: "transparent",
          border: "none",
          color: theme.colors.text,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 16,
          fontWeight: 600,
          padding: 0,
        }}
      >
        {formatWeekdayMonthDay(toPlainDate(value))}
      </button>
      {open && (
        <>
          {/* Full-screen catcher so a click anywhere else dismisses the popover. */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 999,
              backgroundColor: theme.colors.card,
              border: `1px solid ${withOpacity(theme.colors.text, 0.15)}`,
              borderRadius: theme.borderRadius,
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
              padding: 8,
            }}
          >
            <DayPicker
              mode="single"
              selected={value}
              onSelect={(next) => {
                if (next) onChange(next);
                setOpen(false);
              }}
              showOutsideDays
              weekStartsOn={1}
              style={calendarVars}
              modifiersStyles={{
                today: {
                  outline: `1px solid ${accent}`,
                  outlineOffset: "-1px",
                  borderRadius: theme.borderRadius,
                },
                selected: {
                  backgroundColor: withOpacity(accent, 0.2),
                  color: theme.colors.text,
                  borderRadius: theme.borderRadius,
                },
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
