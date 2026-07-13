import { StyleSheet, View } from "react-native";

import { VIEW_META } from "@/components/DayViewSwitcher";
import { GlassIconButton } from "@/components/GlassIconButton";
import { TTodayPane, TTodayPanes } from "@/hooks/useTodayPanes";
import { useTheme } from "@/utils/theme";

type TDayPaneTogglesProps = {
  panes: TTodayPanes;
  onTogglePane: (pane: TTodayPane) => void;
  /** Notes toggle is hidden when disabled in settings. */
  enableNotes: boolean;
  /** Journal toggle is hidden when disabled in settings. */
  enableJournal: boolean;
  /** Calendar toggle is hidden when disabled in settings. */
  enableCalendar: boolean;
};

type TPaneToggleOption = {
  pane: TTodayPane;
  label: string;
  icon: (typeof VIEW_META)[TTodayPane]["icon"];
  ionicon: (typeof VIEW_META)[TTodayPane]["ionicon"];
  active: boolean;
  onToggle: () => void;
};

/**
 * Builds the toggle button descriptors: Notes/Journal/Calendar, each only
 * when enabled, with the pane's current on/off state. Exported so the
 * gating/selection logic is unit-testable without rendering native buttons.
 * Mirrors `dayViewOptions`' shape (collect the enabled panes, then map).
 */
export function paneToggleOptions(
  panes: TTodayPanes,
  onTogglePane: (pane: TTodayPane) => void,
  enableNotes: boolean,
  enableJournal: boolean,
  enableCalendar: boolean,
): TPaneToggleOption[] {
  const enabled: TTodayPane[] = [];
  if (enableNotes) enabled.push("notes");
  if (enableJournal) enabled.push("journal");
  if (enableCalendar) enabled.push("calendar");

  return enabled.map((pane) => ({
    pane,
    label: VIEW_META[pane].label,
    icon: VIEW_META[pane].icon,
    ionicon: VIEW_META[pane].ionicon,
    active: panes[pane],
    onToggle: () => onTogglePane(pane),
  }));
}

/**
 * The large-screen Today header's pane toggles: one round glassy button per
 * optional pane (Notes/Journal/Calendar), tinted primary when the pane is
 * showing and text-colored when it's hidden. Tasks has no toggle — it's
 * always visible. See `DayViewSwitcher` for the small-screen equivalent.
 */
export function DayPaneToggles({
  panes,
  onTogglePane,
  enableNotes,
  enableJournal,
  enableCalendar,
}: TDayPaneTogglesProps) {
  const theme = useTheme();
  const options = paneToggleOptions(
    panes,
    onTogglePane,
    enableNotes,
    enableJournal,
    enableCalendar,
  );

  return (
    <View style={[styles.row, { gap: theme.gap }]}>
      {options.map((option) => (
        <GlassIconButton
          key={option.pane}
          accessibilityLabel={`Toggle ${option.label.toLowerCase()} pane`}
          active={option.active}
          ionicon={option.ionicon}
          onPress={option.onToggle}
          sfSymbol={option.icon}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
