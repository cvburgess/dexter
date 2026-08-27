import { useTheme } from "@/utils/theme";

import { GlassIconButton } from "./GlassIconButton";
import type { TIconName } from "./Icon.types";
import { IconMenu } from "./IconMenu";
import { TIconMenuOption, TIconMenuSection } from "./IconMenu.types";

/** The day views selectable from the Today tab. */
export type TDayView = "tasks" | "notes" | "calendar";

/**
 * Icon metadata for each day view, shared with `DayPaneToggles` (the
 * large-screen equivalent) so both surfaces use the same icons/labels.
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
  /** When provided, adds a "Backlog" action in its own section — kept in this
   * menu rather than a header button so it doesn't crowd DayNav's arrow. */
  onOpenDrawer?: () => void;
  /** Warning-yellow attention dot when Backlog holds overdue/left-behind
   * tasks (DEX-58); lives here since the Backlog action lives in this menu. */
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

/** Today-tab view switcher between Tasks/Notes/Calendar, icon per active
 * view; Notes/Calendar gated by settings (DEX-37, DEX-39). */
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
    // Tints the Backlog row to match the attention dot (DEX-58); iconColor
    // recolors the iOS label, titleColor the Android/web one.
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
    // Pinned to the button's size — @expo/ui MenuView sizes asynchronously
    // and a content-sized trigger renders untappable (StatusButton/ListButton).
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
