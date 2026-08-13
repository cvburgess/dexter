import { useTheme } from "@/utils/theme";

import { GlassIconButton } from "./GlassIconButton";
import type { TIconName } from "./Icon.types";
import { IconMenu } from "./IconMenu";
import { TIconMenuOption, TIconMenuSection } from "./IconMenu.types";

/** The day views selectable from the Today tab. */
export type TDayView = "tasks" | "notes" | "calendar";

/**
 * Icon metadata for each day view, shared with the ritual's `STEP_ICONS` (see
 * `RitualStepSwitcher.shared.ts`) so a step that opens a day's surface wears the
 * same icon that surface does.
 */
export const VIEW_META: Record<TDayView, { label: string; icon: TIconName }> = {
  tasks: {
    label: "Tasks",
    icon: { sf: "checklist", ionicon: "list-outline" },
  },
  notes: {
    label: "Notes",
    icon: { sf: "note.text", ionicon: "document-text-outline" },
  },
  calendar: {
    label: "Calendar",
    icon: { sf: "calendar", ionicon: "calendar-outline" },
  },
};

type TDayViewSwitcherProps = {
  view: TDayView;
  onChangeView: (view: TDayView) => void;
  /** Notes is hidden when disabled in settings. */
  enableNotes: boolean;
  /** Calendar is hidden when disabled in settings. */
  enableCalendar: boolean;
  /**
   * When provided, a "Backlog" action is appended below the view options
   * (in its own divided section) that opens the drawer. Kept in this menu
   * rather than a standalone header button so it doesn't crowd `DayNav`'s
   * next-day arrow.
   */
  onOpenDrawer?: () => void;
  /**
   * Shows the warning-yellow attention dot on the trigger button when the
   * Backlog holds overdue or left-behind tasks (DEX-58). The dot lives here
   * (rather than a dedicated Backlog button) because the small-screen Backlog
   * action is inside this menu.
   */
  attention?: boolean;
};

/**
 * Builds the menu options for the switcher: Tasks always, Notes/Calendar only
 * when enabled, with the active view checked. Exported so the selection
 * wiring is unit-testable without the platform menu host.
 */
export function dayViewOptions(
  view: TDayView,
  onChangeView: (view: TDayView) => void,
  enableNotes: boolean,
  enableCalendar: boolean,
): TIconMenuOption[] {
  const views: TDayView[] = ["tasks"];
  if (enableNotes) views.push("notes");
  if (enableCalendar) views.push("calendar");

  return views.map((id) => ({
    id,
    title: VIEW_META[id].label,
    icon: VIEW_META[id].icon,
    isSelected: id === view,
    onSelect: () => onChangeView(id),
  }));
}

/**
 * The Today-tab view switcher: a circular icon-only button (liquid glass on
 * iOS, a plain circle elsewhere — see `GlassIconButton`) that opens an
 * `IconMenu` for moving between Tasks, Notes, and Calendar. Its icon reflects
 * the active view. All views share the Today screen's single date, so switching
 * never changes the selected day. Notes/Calendar entries appear only when
 * enabled in settings (DEX-37, DEX-39). The journal is not among them — it
 * moved to the Ritual tab (DEX-105). When `onOpenDrawer` is given, a
 * "Backlog" action is added below the view options (DEX-33).
 */
export function DayViewSwitcher({
  view,
  onChangeView,
  enableNotes,
  enableCalendar,
  onOpenDrawer,
  attention,
}: TDayViewSwitcherProps) {
  const theme = useTheme();
  const options = dayViewOptions(
    view,
    onChangeView,
    enableNotes,
    enableCalendar,
  );

  const sections: TIconMenuSection[] = [{ options }];
  if (onOpenDrawer) {
    // When the attention dot is showing, tint the Backlog row the same
    // warning-yellow (`priority[0]`) as the dot so it's clear what the dot
    // refers to (DEX-58). `iconColor` also recolors the label on iOS; on
    // Android/web `titleColor` carries the label.
    const attentionColor = attention ? theme.colors.priority[0] : undefined;
    sections.push({
      options: [
        {
          id: "drawer",
          title: "Backlog",
          icon: { sf: "tray.full", ionicon: "file-tray-full-outline" },
          iconColor: attentionColor,
          titleColor: attentionColor,
          onSelect: onOpenDrawer,
        },
      ],
    });
  }

  return (
    // Pin the IconMenu host to the button's size: the native @expo/ui MenuView
    // sizes asynchronously and a content-sized trigger renders untappable on
    // device (same reason StatusButton/ListButton pin theirs).
    <IconMenu
      accessibilityLabel="Switch view"
      sections={sections}
      style={{ width: theme.controls.md, height: theme.controls.md }}
    >
      <GlassIconButton
        accessibilityLabel="Switch view"
        indicator={attention}
        ionicon={VIEW_META[view].icon.ionicon}
        sfSymbol={VIEW_META[view].icon.sf}
      />
    </IconMenu>
  );
}
