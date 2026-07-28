import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/utils/theme";
import { weekOf } from "@/utils/weekStartEnd";

type TWeekNavProps = {
  /** The Monday of the week on screen. */
  monday: Temporal.PlainDate;
  onChangeWeek: (monday: Temporal.PlainDate) => void;
};

/**
 * Week-at-a-time navigation for the Week tab (DEX-96) — the sibling of
 * `DayNav`, and a port of the legacy dexter-app's `WeekNav`.
 *
 * Deliberately simpler than `DayNav`: there is no calendar-picker branch, so
 * the center label is *always* the "back to this week" shortcut rather than
 * flipping roles on the current week. The legacy view worked the same way, and
 * a picker that jumps to a single date has little to say about which week to
 * show. Arrow and label metrics are copied from `DayNav` so the two tabs' nav
 * rows line up.
 */
export function WeekNav({ monday, onChangeWeek }: TWeekNavProps) {
  const theme = useTheme();

  // ISO week numbering: `yearOfWeek` is not always `year`. A week owned by the
  // neighbouring year (Dec 30 2024 is week 1 of 2025; Jan 1 2027 is week 53 of
  // 2026) would otherwise be labelled with the wrong year — the legacy app's
  // bug, which used `.year`. Both accessors are ISO-calendar only and this app
  // is ISO throughout, but `?? year` keeps a non-ISO calendar from rendering
  // "undefined" rather than a slightly wrong year.
  const label = `Week ${monday.weekOfYear ?? ""}, ${monday.yearOfWeek ?? monday.year}`;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityLabel="Previous week"
        onPress={() => onChangeWeek(monday.subtract({ weeks: 1 }))}
        style={styles.arrow}
      >
        <Text style={[styles.arrowText, { color: theme.colors.text }]}>‹</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="Go to this week"
        onPress={() => onChangeWeek(weekOf(Temporal.Now.plainDateISO()).monday)}
      >
        <Text style={[styles.label, { color: theme.colors.text }]}>
          {label}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="Next week"
        onPress={() => onChangeWeek(monday.add({ weeks: 1 }))}
        style={styles.arrow}
      >
        <Text style={[styles.arrowText, { color: theme.colors.text }]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

// Mirrors DayNav's metrics exactly (arrow hit area, 24pt chevrons, a
// fixed-width centered label) so the Week and Today headers sit on the same
// baseline and the arrows don't shift as the label's width changes.
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  arrow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  arrowText: {
    fontSize: 24,
    fontWeight: "600",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 160,
    textAlign: "center",
  },
});
