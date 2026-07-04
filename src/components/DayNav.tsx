import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { formatWeekdayMonthDay } from "@/utils/formatPlainDate";
import { useTheme } from "@/utils/theme";

type TDayNavProps = {
  date: Temporal.PlainDate;
  onChangeDate: (date: Temporal.PlainDate) => void;
};

export function DayNav({ date, onChangeDate }: TDayNavProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityLabel="Previous day"
        onPress={() => onChangeDate(date.subtract({ days: 1 }))}
        style={styles.arrow}
      >
        <Text style={[styles.arrowText, { color: theme.colors.text }]}>‹</Text>
      </TouchableOpacity>
      <Text style={[styles.date, { color: theme.colors.text }]}>
        {formatWeekdayMonthDay(date)}
      </Text>
      <TouchableOpacity
        accessibilityLabel="Next day"
        onPress={() => onChangeDate(date.add({ days: 1 }))}
        style={styles.arrow}
      >
        <Text style={[styles.arrowText, { color: theme.colors.text }]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

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
  date: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 160,
    textAlign: "center",
  },
});
