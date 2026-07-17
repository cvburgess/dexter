import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme, withOpacity } from "@/utils/theme";

/** Which day-of-week numbering the caller's `selected`/`onToggle` values use:
 * cron (0 = Sunday, per settings/tasks/[id].tsx's repeat schedules) or
 * Temporal's `dayOfWeek` (Monday = 1 … Sunday = 7, per habits). */
export type TWeekdayValueSource = "cron" | "temporal";

// Day names, Monday-first — the order every chip row displays in.
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Each source's day values, in the same Monday-first order as DAY_NAMES.
const VALUES_BY_SOURCE: Record<TWeekdayValueSource, readonly number[]> = {
  cron: [1, 2, 3, 4, 5, 6, 0],
  temporal: [1, 2, 3, 4, 5, 6, 7],
};

type TWeekdayPickerProps = {
  valueSource: TWeekdayValueSource;
  selected: readonly number[];
  onToggle: (value: number) => void;
};

/** A row of toggleable weekday chips, shared by the repeat-schedule and habit
 * forms. Chip labels/accessibility labels are derived from the day name;
 * `valueSource` picks which day-of-week numbering `selected`/`onToggle`
 * round-trip. */
export function WeekdayPicker({
  valueSource,
  selected,
  onToggle,
}: TWeekdayPickerProps) {
  const theme = useTheme();
  const inputBorder = withOpacity(theme.colors.text, 0.1);
  const values = VALUES_BY_SOURCE[valueSource];

  return (
    <View style={styles.days}>
      {values.map((value, index) => {
        const dayName = DAY_NAMES[index];
        const isSelected = selected.includes(value);
        return (
          <TouchableOpacity
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={dayName}
            onPress={() => onToggle(value)}
            style={[
              styles.day,
              {
                backgroundColor: isSelected
                  ? theme.colors.primary
                  : "transparent",
                borderColor: inputBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.dayLabel,
                {
                  color: isSelected
                    ? theme.colors.primaryContent
                    : theme.colors.textSecondary,
                },
              ]}
            >
              {dayName.charAt(0)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  day: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  days: {
    flexDirection: "row",
    gap: 4,
  },
});
