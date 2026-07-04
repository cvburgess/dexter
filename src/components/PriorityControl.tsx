import { SymbolView } from "expo-symbols";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ETaskPriority } from "@/api/tasks";
import { useTheme } from "@/utils/theme";

type TPriorityControlProps = {
  priority: ETaskPriority;
  onChangePriority: (priority: ETaskPriority) => void;
};

/**
 * Ported from dexter-app's `PriorityButton` icons (Fire/Star/Alarm/Umbrella),
 * ordered to match the shorthand tokens: `!` → `!!!!`.
 */
const OPTIONS = [
  {
    label: "Urgent",
    value: ETaskPriority.URGENT,
    ios: "alarm",
    material: "alarm",
  },
  {
    label: "Important",
    value: ETaskPriority.IMPORTANT,
    ios: "star",
    material: "star",
  },
  {
    label: "Important & Urgent",
    value: ETaskPriority.IMPORTANT_AND_URGENT,
    ios: "flame",
    material: "local_fire_department",
  },
  {
    label: "Neither",
    value: ETaskPriority.NEITHER,
    ios: "umbrella",
    material: "umbrella",
  },
] as const;

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
      {OPTIONS.map((option) => {
        const isSelected = option.value === priority;
        // Selected options fill with the priority color and use its matching
        // content color. Unselected NEITHER renders in the text color, since
        // its priority color is the card color (invisible on the background).
        const iconColor = isSelected
          ? theme.colors.priorityContent[option.value]
          : option.value === ETaskPriority.NEITHER
            ? theme.colors.text
            : theme.colors.priority[option.value];

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
            <SymbolView
              name={{
                ios: option.ios,
                android: option.material,
                web: option.material,
              }}
              size={20}
              tintColor={iconColor}
            />
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
