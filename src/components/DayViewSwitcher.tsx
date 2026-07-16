import Ionicons from "@react-native-vector-icons/ionicons";
import type { SymbolViewProps } from "expo-symbols";
import type { ComponentProps } from "react";

import { GlassIconButton } from "./GlassIconButton";
import { IconMenu } from "./IconMenu";
import { TIconMenuOption, TIconMenuSection } from "./IconMenu.types";

/** The day views selectable from the Today tab. */
export type TDayView = "tasks" | "notes" | "journal" | "calendar";

const BUTTON_SIZE = 40;

/**
 * Icon metadata for each day view, shared with `DayPaneToggles` (the
 * large-screen equivalent) so both surfaces use the same icons/labels.
 */
export const VIEW_META: Record<
  TDayView,
  {
    label: string;
    /** SF Symbol (iOS) + Ionicons (Android/web) for the circular button icon. */
    icon: SymbolViewProps["name"];
    ionicon: ComponentProps<typeof Ionicons>["name"];
  }
> = {
  tasks: { label: "Tasks", icon: "checklist", ionicon: "list-outline" },
  notes: {
    label: "Notes",
    icon: "note.text",
    ionicon: "document-text-outline",
  },
  journal: { label: "Journal", icon: "book", ionicon: "book-outline" },
  calendar: {
    label: "Calendar",
    icon: "calendar",
    ionicon: "calendar-outline",
  },
};

type TDayViewSwitcherProps = {
  view: TDayView;
  onChangeView: (view: TDayView) => void;
  /** Notes is hidden when disabled in settings. */
  enableNotes: boolean;
  /** Journal is hidden when disabled in settings. */
  enableJournal: boolean;
  /** Calendar is hidden when disabled in settings. */
  enableCalendar: boolean;
  /**
   * When provided, a "Backlog" action is appended below the view options
   * (in its own divided section) that opens the drawer. Kept in this menu
   * rather than a standalone header button so it doesn't crowd `DayNav`'s
   * next-day arrow.
   */
  onOpenDrawer?: () => void;
};

/**
 * Builds the menu options for the switcher: Tasks always, Notes/Journal/Calendar
 * only when enabled, with the active view checked. Exported so the selection
 * wiring is unit-testable without the platform menu host.
 */
export function dayViewOptions(
  view: TDayView,
  onChangeView: (view: TDayView) => void,
  enableNotes: boolean,
  enableJournal: boolean,
  enableCalendar: boolean,
): TIconMenuOption[] {
  const views: TDayView[] = ["tasks"];
  if (enableNotes) views.push("notes");
  if (enableJournal) views.push("journal");
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
 * `IconMenu` for moving between Tasks, Notes, and Journal. Its icon reflects the
 * active view. All views share the Today screen's single date, so switching
 * never changes the selected day. Notes/Journal/Calendar entries appear only
 * when enabled in settings (DEX-37, DEX-39). When `onOpenDrawer` is given, a
 * "Backlog" action is added below the view options (DEX-33).
 */
export function DayViewSwitcher({
  view,
  onChangeView,
  enableNotes,
  enableJournal,
  enableCalendar,
  onOpenDrawer,
}: TDayViewSwitcherProps) {
  const options = dayViewOptions(
    view,
    onChangeView,
    enableNotes,
    enableJournal,
    enableCalendar,
  );

  const sections: TIconMenuSection[] = [{ options }];
  if (onOpenDrawer) {
    sections.push({
      options: [
        {
          id: "drawer",
          title: "Backlog",
          icon: "tray.full",
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
      style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
    >
      <GlassIconButton
        accessibilityLabel="Switch view"
        ionicon={VIEW_META[view].ionicon}
        sfSymbol={VIEW_META[view].icon}
        size={BUTTON_SIZE}
      />
    </IconMenu>
  );
}
