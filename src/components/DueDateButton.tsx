import { Temporal } from "@js-temporal/polyfill";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/utils/theme";

type TDueDateButtonProps = {
  dueOn: string | null;
  priorityColor: string;
  contentColor: string;
  /** Placement gap, taken as a style not a wrapper — this renders nothing
   * without a `dueOn`, and a wrapper would still apply margin to nothing. */
  style?: StyleProp<ViewStyle>;
};

/** Display-only day countdown, hidden when `dueOn` is unset; inverts from
 * priority-color to priority-content fill once overdue, for emphasis. */
export function DueDateButton({
  dueOn,
  priorityColor,
  contentColor,
  style,
}: TDueDateButtonProps) {
  const theme = useTheme();

  if (!dueOn) return null;

  const daysUntilDue = Temporal.Now.plainDateISO().until(
    Temporal.PlainDate.from(dueOn),
  ).days;
  const isOverdue = daysUntilDue <= 0;

  const backgroundColor = isOverdue ? contentColor : priorityColor;
  const foregroundColor = isOverdue ? priorityColor : contentColor;

  return (
    <View
      testID="due-date-badge"
      style={[
        styles.badge,
        {
          backgroundColor,
          borderColor: foregroundColor,
          borderRadius: theme.radii.full,
          height: theme.controls.sm,
          // A pill, not a circle: a three-digit countdown has to fit.
          minWidth: theme.controls.sm,
          paddingHorizontal: theme.space.xs,
        },
        style,
      ]}
    >
      <Text style={[theme.fonts.body, { color: foregroundColor }]}>
        {daysUntilDue}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
  },
});
