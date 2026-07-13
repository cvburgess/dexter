import Ionicons from "@react-native-vector-icons/ionicons";
import type { SymbolViewProps } from "expo-symbols";
import type { ComponentProps } from "react";

import { GlassIconButton } from "./GlassIconButton";
import { IconMenu } from "./IconMenu";
import { TIconMenuOption } from "./IconMenu.types";

/** The day views selectable from the Today tab. */
export type TDayView = "tasks" | "notes" | "journal" | "calendar";

const BUTTON_SIZE = 40;

const VIEW_META: Record<
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
  calendar: { label: "Calendar", icon: "calendar", ionicon: "calendar-outline" },
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
 * when enabled in settings (DEX-37, DEX-39).
 */
export function DayViewSwitcher({
  view,
  onChangeView,
  enableNotes,
  enableJournal,
  enableCalendar,
}: TDayViewSwitcherProps) {
  const options = dayViewOptions(
    view,
    onChangeView,
    enableNotes,
    enableJournal,
    enableCalendar,
  );

  return (
    // Pin the IconMenu host to the button's size: the native @expo/ui MenuView
    // sizes asynchronously and a content-sized trigger renders untappable on
    // device (same reason StatusButton/ListButton pin theirs).
    <IconMenu
      accessibilityLabel="Switch view"
      sections={[{ options }]}
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
