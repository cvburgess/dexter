import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, Text, View } from "react-native";

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
      style={[styles.badge, { backgroundColor, borderColor: foregroundColor }]}
    >
      <Text style={[styles.text, { color: foregroundColor }]}>
        {daysUntilDue}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    minWidth: 32,
    paddingHorizontal: 6,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
  },
});
