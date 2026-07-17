import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme, withOpacity } from "@/utils/theme";

type TWeekdayOption = {
  /** Opaque day identifier — cron (0 = Sunday) or Temporal (1 = Monday) — the
   * component doesn't interpret it, only round-trips it via `onToggle`. */
  value: number;
  label: string;
  accessibilityLabel: string;
};

type TWeekdayPickerProps = {
  /** Chips in display order. */
  days: readonly TWeekdayOption[];
  selected: readonly number[];
  onToggle: (value: number) => void;
};

/** A row of toggleable weekday chips, shared by the repeat-schedule and habit
 * forms — each owns its own day-value encoding and accessibility label
 * format via `days`. */
export function WeekdayPicker({
  days,
  selected,
  onToggle,
}: TWeekdayPickerProps) {
  const theme = useTheme();
  const inputBorder = withOpacity(theme.colors.text, 0.1);

  return (
    <View style={styles.days}>
      {days.map((day) => {
        const isSelected = selected.includes(day.value);
        return (
          <TouchableOpacity
            key={day.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={day.accessibilityLabel}
            onPress={() => onToggle(day.value)}
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
              {day.label}
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
