import { SymbolView } from "expo-symbols";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ETaskPriority } from "@/api/tasks";
import { Theme, useTheme } from "@/utils/theme";

type TPriorityControlProps = {
  priority: ETaskPriority;
  onChangePriority: (priority: ETaskPriority) => void;
};

/**
 * Ported from dexter-app's `PriorityButton` icons (Fire/Star/Alarm/Umbrella),
 * ordered to match the shorthand tokens: `!` → `!!!!`.
 */
export const PRIORITY_OPTIONS = [
  {
    label: "Urgent",
    value: ETaskPriority.URGENT,
    icon: { ios: "alarm", android: "alarm", web: "alarm" },
  },
  {
    label: "Important",
    value: ETaskPriority.IMPORTANT,
    icon: { ios: "star", android: "star", web: "star" },
  },
  {
    label: "Important & Urgent",
    value: ETaskPriority.IMPORTANT_AND_URGENT,
    icon: {
      ios: "flame",
      android: "local_fire_department",
      web: "local_fire_department",
    },
  },
  {
    label: "Neither",
    value: ETaskPriority.NEITHER,
    icon: { ios: "umbrella", android: "umbrella", web: "umbrella" },
  },
] as const;

/**
 * The accent color for a priority's icon. NEITHER's priority color is the
 * card color (invisible on the background), so it renders in the text color
 * instead.
 */
export const priorityIconColor = (
  value: ETaskPriority,
  theme: Theme,
): string =>
  value === ETaskPriority.NEITHER
    ? theme.colors.text
    : theme.colors.priority[value];

/**
 * A segmented-control-style row of priority icons tinted with the theme's
 * priority colors. Tapping the selected icon again clears back to
 * unprioritized.
 */
export function PriorityControl({
  priority,
  onChangePriority,
}: TPriorityControlProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {PRIORITY_OPTIONS.map((option) => {
        const isSelected = option.value === priority;
        // Selected options fill with the priority color and use its matching
        // content color.
        const iconColor = isSelected
          ? theme.colors.priorityContent[option.value]
          : priorityIconColor(option.value, theme);

        return (
          <TouchableOpacity
            accessibilityLabel={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={option.value}
            style={[
              styles.option,
              isSelected && {
                backgroundColor: theme.colors.priority[option.value],
              },
            ]}
            onPress={() =>
              onChangePriority(
                isSelected ? ETaskPriority.UNPRIORITIZED : option.value,
              )
            }
          >
            <SymbolView name={option.icon} size={20} tintColor={iconColor} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
