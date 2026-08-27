import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { formatWeekdayMonthDay } from "@/utils/formatPlainDate";
import { dateToPlainDate } from "@/utils/plainDate";
import { SHADOW_LG, useTheme, withOpacity } from "@/utils/theme";

import { TDateFieldProps } from "./DateField.types";
import { WebOverlay } from "./WebOverlay.web";

const POPOVER_WIDTH = 280;
const VIEWPORT_MARGIN = 8;

// Matches RNW's "System" font token (kept in sync with SYSTEM_FONT_STACK) —
// a raw <button>/react-day-picker default to their own UA fonts otherwise.
const SYSTEM_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

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

/** A plain button opens a themed `react-day-picker` — the community
 * `DateTimePicker` renders nothing here. Goes through `WebOverlay.web.tsx`. */
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
    fontFamily: SYSTEM_FONT,
  } as React.CSSProperties;

  const popover = anchor && (
    <WebOverlay>
      {/* Full-screen catcher so a click anywhere else dismisses the popover. */}
      <div onClick={close} style={{ position: "fixed", inset: 0 }} />
      <div
        style={{
          position: "fixed",
          top: anchor.top,
          left: anchor.left,
          width: POPOVER_WIDTH,
          backgroundColor: theme.colors.surfaceSunken,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radii.md,
          boxShadow: SHADOW_LG,
          padding: theme.space.sm,
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
          // CSS variables theme react-day-picker's native styling — keeps
          // the native circle rather than overriding the day shape.
          style={calendarVars}
        />
      </div>
    </WebOverlay>
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
          fontFamily: SYSTEM_FONT,
          fontSize: theme.fonts.control.fontSize,
          fontWeight: theme.fonts.control.fontWeight,
          padding: 0,
        }}
      >
        {formatWeekdayMonthDay(dateToPlainDate(value))}
      </button>
      {popover}
    </div>
  );
}
