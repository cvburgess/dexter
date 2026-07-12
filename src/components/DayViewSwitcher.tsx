import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, withOpacity } from "@/utils/theme";

import { IconMenu } from "./IconMenu";
import { TIconMenuOption } from "./IconMenu.types";

/** The three day views selectable from the Today tab. */
export type TDayView = "tasks" | "notes" | "journal";

const VIEW_META: Record<
  TDayView,
  { label: string; icon: SymbolViewProps["name"] }
> = {
  tasks: { label: "Tasks", icon: "checklist" },
  notes: { label: "Notes", icon: "note.text" },
  journal: { label: "Journal", icon: "book" },
};

type TDayViewSwitcherProps = {
  view: TDayView;
  onChangeView: (view: TDayView) => void;
  /** Notes is hidden when disabled in settings. */
  enableNotes: boolean;
  /** Journal is hidden when disabled in settings. */
  enableJournal: boolean;
};

/**
 * Builds the menu options for the switcher: Tasks always, Notes/Journal only
 * when enabled, with the active view checked. Exported so the selection wiring
 * is unit-testable without the platform menu host.
 */
export function dayViewOptions(
  view: TDayView,
  onChangeView: (view: TDayView) => void,
  enableNotes: boolean,
  enableJournal: boolean,
): TIconMenuOption[] {
  const views: TDayView[] = ["tasks"];
  if (enableNotes) views.push("notes");
  if (enableJournal) views.push("journal");

  return views.map((id) => ({
    id,
    title: VIEW_META[id].label,
    icon: VIEW_META[id].icon,
    isSelected: id === view,
    onSelect: () => onChangeView(id),
  }));
}

/**
 * The Today-tab view switcher: a pill that opens an `IconMenu` for moving
 * between Tasks, Notes, and Journal. All three views share the Today screen's
 * single date, so switching never changes the selected day. Notes/Journal
 * entries appear only when enabled in settings (DEX-37).
 */
export function DayViewSwitcher({
  view,
  onChangeView,
  enableNotes,
  enableJournal,
}: TDayViewSwitcherProps) {
  const theme = useTheme();

  const options = dayViewOptions(
    view,
    onChangeView,
    enableNotes,
    enableJournal,
  );

  return (
    <IconMenu
      accessibilityLabel="Switch view"
      sections={[{ options }]}
      style={[
        styles.trigger,
        {
          backgroundColor: theme.colors.card,
          borderColor: withOpacity(theme.colors.text, 0.1),
          borderRadius: theme.borderRadius,
        },
      ]}
    >
      <View style={styles.triggerContent}>
        <SymbolView
          name={VIEW_META[view].icon}
          size={16}
          tintColor={theme.colors.text}
        />
        <Text style={[styles.triggerLabel, { color: theme.colors.text }]}>
          {VIEW_META[view].label}
        </Text>
        <Text style={[styles.chevron, { color: theme.colors.textSecondary }]}>
          ⌄
        </Text>
      </View>
    </IconMenu>
  );
}

const styles = StyleSheet.create({
  // Pin the trigger to a fixed size. The native `@expo/ui` MenuView host sizes
  // asynchronously and won't derive a reliable tappable frame from padding
  // alone (the same reason StatusButton/ListButton pin theirs to 32×32); a
  // content-sized trigger renders untappable on device. Fixed width fits the
  // longest label ("Journal").
  trigger: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    justifyContent: "center",
    width: 116,
  },
  triggerContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  triggerLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  chevron: {
    fontSize: 14,
    marginTop: -4,
  },
});
