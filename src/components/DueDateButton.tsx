import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/utils/theme";

type TDueDateButtonProps = {
  dueOn: string | null;
};

/** Display-only day countdown; hidden when `dueOn` is unset. Setting/changing the due date is not supported here. */
export function DueDateButton({ dueOn }: TDueDateButtonProps) {
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
        {
          backgroundColor: shouldWarn
            ? theme.colors.error
            : theme.colors.background,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: shouldWarn ? theme.colors.errorContent : theme.colors.text },
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
