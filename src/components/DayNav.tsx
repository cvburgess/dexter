import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { DateField } from "@/components/DateField";
import {
  PERIOD_NAV_CENTER_MIN_WIDTH,
  PeriodNav,
  PeriodNavLabel,
} from "@/components/PeriodNav";
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
    <PeriodNav
      nextLabel="Next day"
      onNext={() => onChangeDate(date.add({ days: 1 }))}
      onPrev={() => onChangeDate(date.subtract({ days: 1 }))}
      prevLabel="Previous day"
    >
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
          <PeriodNavLabel>{formatWeekdayMonthDay(date)}</PeriodNavLabel>
        </TouchableOpacity>
      )}
    </PeriodNav>
  );
}

const styles = StyleSheet.create({
  // The picker is the one center control that isn't a `PeriodNavLabel`, so it
  // takes the slot's width itself rather than inheriting it from the label.
  picker: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: PERIOD_NAV_CENTER_MIN_WIDTH,
  },
});
