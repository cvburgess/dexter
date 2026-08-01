import { Temporal } from "@js-temporal/polyfill";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/utils/theme";

type TDueDateButtonProps = {
  dueOn: string | null;
  priorityColor: string;
  contentColor: string;
  /**
   * Where the caller is placing this badge — the gap between it and whatever
   * precedes it. The badge carries no spacing of its own (see docs/design.md,
   * "Who owns spacing"), and taking it as a style rather than a wrapper matters
   * here: this renders nothing at all without a `dueOn`, and a wrapper would go
   * on applying its margin to a badge that isn't there.
   */
  style?: StyleProp<ViewStyle>;
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
