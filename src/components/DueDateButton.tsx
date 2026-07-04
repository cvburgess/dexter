import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, withOpacity } from "@/utils/theme";

type TDueDateButtonProps = {
  dueOn: string | null;
  contentColor: string;
};

/**
 * Display-only day countdown; hidden when `dueOn` is unset. Setting/changing
 * the due date is not supported here. Matches the other card buttons'
 * outline style, except when overdue/due-soon, when it swaps to a solid
 * warning fill for emphasis (dexter-app's `overdueClasses`).
 */
export function DueDateButton({ dueOn, contentColor }: TDueDateButtonProps) {
  const theme = useTheme();
  if (!dueOn) return null;

  const daysUntilDue = Temporal.Now.plainDateISO().until(
    Temporal.PlainDate.from(dueOn),
  ).days;
  const shouldWarn = daysUntilDue <= 1;

  return (
    <View
      testID="due-date-badge"
      style={[
        styles.badge,
        shouldWarn
          ? { backgroundColor: theme.colors.error }
          : { borderWidth: 1, borderColor: withOpacity(contentColor, 0.25) },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: shouldWarn ? theme.colors.errorContent : contentColor },
        ]}
      >
        {daysUntilDue}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    borderRadius: 999,
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
