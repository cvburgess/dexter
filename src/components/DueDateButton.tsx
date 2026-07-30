import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/utils/theme";

type TDueDateButtonProps = {
  dueOn: string | null;
  priorityColor: string;
  contentColor: string;
};

/**
 * Display-only day countdown; hidden when `dueOn` is unset. Setting/changing
 * the due date is not supported here. Normally the badge sits on the priority
 * color with priority-content text/outline (matching the card); once overdue
 * (due today or earlier) it inverts — a solid priority-content fill with
 * priority-color text/outline — for emphasis.
 */
export function DueDateButton({
  dueOn,
  priorityColor,
  contentColor,
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
      ]}
    >
      <Text style={[theme.fonts.caption, { color: foregroundColor }]}>
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
