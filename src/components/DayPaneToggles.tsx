import { StyleSheet, View } from "react-native";

import { VIEW_META } from "@/components/DayViewSwitcher";
import { GlassIconButton } from "@/components/GlassIconButton";
import type { TIconName } from "@/components/Icon.types";
import { TTodayPane, TTodayPanes } from "@/hooks/useTodayPanes";
import { useTheme } from "@/utils/theme";

// This component only ever toggles Notes/Calendar — the task drawer
// (DEX-33) is a standalone header button, not one of these toggles — even
// though it shares `TTodayPanes`' persisted store via `onTogglePane`.
type TDisplayPane = Exclude<TTodayPane, "drawer">;

type TDayPaneTogglesProps = {
  panes: TTodayPanes;
  onTogglePane: (pane: TTodayPane) => void;
  /** Notes toggle is hidden when disabled in settings. */
  enableNotes: boolean;
  /** Calendar toggle is hidden when disabled in settings. */
  enableCalendar: boolean;
};

type TPaneToggleOption = {
  pane: TDisplayPane;
  label: string;
  icon: TIconName;
  active: boolean;
  onToggle: () => void;
};

/**
 * Builds the toggle button descriptors: Notes/Calendar, each only when
 * enabled, with the pane's current on/off state. Exported so the
 * gating/selection logic is unit-testable without rendering native buttons.
 * Mirrors `dayViewOptions`' shape (collect the enabled panes, then map).
 */
export function paneToggleOptions(
  panes: TTodayPanes,
  onTogglePane: (pane: TTodayPane) => void,
  enableNotes: boolean,
  enableCalendar: boolean,
): TPaneToggleOption[] {
  const enabled: TDisplayPane[] = [];
  if (enableNotes) enabled.push("notes");
  if (enableCalendar) enabled.push("calendar");

  return enabled.map((pane) => ({
    pane,
    label: VIEW_META[pane].label,
    icon: VIEW_META[pane].icon,
    active: panes[pane],
    onToggle: () => onTogglePane(pane),
  }));
}

/**
 * The large-screen Today header's pane toggles: one round glassy button per
 * optional pane (Notes/Calendar), tinted primary when the pane is
 * showing and text-colored when it's hidden. Tasks has no toggle — it's
 * always visible. See `DayViewSwitcher` for the small-screen equivalent.
 */
export function DayPaneToggles({
  panes,
  onTogglePane,
  enableNotes,
  enableCalendar,
}: TDayPaneTogglesProps) {
  const theme = useTheme();
  const options = paneToggleOptions(
    panes,
    onTogglePane,
    enableNotes,
    enableCalendar,
  );

  return (
    <View style={[styles.row, { gap: theme.space.sm }]}>
      {options.map((option) => (
        <GlassIconButton
          key={option.pane}
          accessibilityLabel={`Toggle ${option.label.toLowerCase()} pane`}
          active={option.active}
          ionicon={option.icon.ionicon}
          onPress={option.onToggle}
          sfSymbol={option.icon.sf}
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
