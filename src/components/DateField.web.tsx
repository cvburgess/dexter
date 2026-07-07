import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const POPOVER_WIDTH = 280;
const VIEWPORT_MARGIN = 8;

type TAnchor = { top: number; left: number };

// Center the popover under the trigger, clamped so it never runs off the edge
// (the new-task chip sits at the right of the row).
const anchorFrom = (rect: DOMRect): TAnchor => {
  const viewportWidth =
    typeof window === "undefined" ? POPOVER_WIDTH : window.innerWidth;
  const centered = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
  const maxLeft = viewportWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
  return {
    top: rect.bottom + 4,
    left: Math.max(VIEWPORT_MARGIN, Math.min(centered, maxLeft)),
  };
};

/**
 * Web implementation of the date field. The community `DateTimePicker` renders
 * nothing on web and the browser's native `input[type="date"]` can't match our
 * label styling, so — following the legacy dexter-app's `ButtonWithPopover` —
 * web renders the date as a plain button that opens a themed `react-day-picker`
 * calendar. The trigger uses the same `"Weekday, Mon D"` format as the rest of
 * the app, and the calendar is themed from `useTheme` (daisyUI tokens in the
 * legacy app map to our theme colors here).
 *
 * The calendar is portalled to `document.body` and positioned `fixed`: the
 * Today screen's task list (a `react-native-reanimated` transformed subtree) and
 * the new-task `ScrollView` both create stacking/clipping contexts that would
 * otherwise paint over or clip an in-tree popover.
 */
export function DateField({
  accentColor,
  onChange,
  testID,
  value,
}: TDateFieldProps) {
  const theme = useTheme();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<TAnchor | null>(null);
  const open = anchor !== null;
  const accent = accentColor ?? theme.colors.primary;

  const openPopover = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    setAnchor(rect ? anchorFrom(rect) : { top: 0, left: 0 });
  };
  const close = () => setAnchor(null);

  // A fixed-positioned popover goes stale when the page scrolls or resizes;
  // just dismiss it rather than tracking the trigger.
  useEffect(() => {
    if (!open || typeof window?.addEventListener !== "function") return;
    const dismiss = () => close();
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  const calendarVars = {
    "--rdp-accent-color": accent,
    "--rdp-accent-background-color": withOpacity(accent, 0.15),
    "--rdp-today-color": accent,
    "--rdp-day-width": "36px",
    "--rdp-day-height": "36px",
    "--rdp-day_button-width": "36px",
    "--rdp-day_button-height": "36px",
    "--rdp-outside-opacity": "0.4",
    margin: 0,
    color: theme.colors.text,
  } as React.CSSProperties;

  const popover = anchor && (
    <>
      {/* Full-screen catcher so a click anywhere else dismisses the popover. */}
      <div
        onClick={close}
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
      />
      <div
        style={{
          position: "fixed",
          top: anchor.top,
          left: anchor.left,
          width: POPOVER_WIDTH,
          zIndex: 9999,
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
            close();
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
  );

  return (
    <div style={{ display: "inline-flex" }}>
      <button
        ref={triggerRef}
        data-testid={testID}
        onClick={() => (open ? close() : openPopover())}
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
      {popover &&
        (typeof document === "undefined"
          ? popover
          : createPortal(popover, document.body))}
    </div>
  );
}
