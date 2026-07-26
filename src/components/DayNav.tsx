import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { DateField } from "@/components/DateField";
import { formatWeekdayMonthDay } from "@/utils/formatPlainDate";
import { dateToPlainDate, plainDateToDate } from "@/utils/plainDate";
import { useTheme } from "@/utils/theme";

type TDayNavProps = {
  date: Temporal.PlainDate;
  onChangeDate: (date: Temporal.PlainDate) => void;
};

export function DayNav({ date, onChangeDate }: TDayNavProps) {
  const theme = useTheme();

  // When already viewing today, the center control becomes a calendar picker
  // (fast jump to any date). Otherwise it keeps the "reset to today" shortcut.
  const isToday = Temporal.Now.plainDateISO().equals(date);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityLabel="Previous day"
        onPress={() => onChangeDate(date.subtract({ days: 1 }))}
        style={styles.arrow}
      >
        <Text style={[styles.arrowText, { color: theme.colors.text }]}>‹</Text>
      </TouchableOpacity>
      {isToday ? (
        <View
          accessible
          accessibilityLabel="Open date picker"
          style={styles.picker}
        >
          <DateField
            accentColor={theme.colors.primary}
            value={plainDateToDate(date)}
            onChange={(next) => onChangeDate(dateToPlainDate(next))}
          />
        </View>
      ) : (
        <TouchableOpacity
          accessibilityLabel="Go to today"
          onPress={() => onChangeDate(Temporal.Now.plainDateISO())}
        >
          <Text style={[styles.date, { color: theme.colors.text }]}>
            {formatWeekdayMonthDay(date)}
          </Text>
        </TouchableOpacity>
      )}
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
  picker: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 160,
  },
});
