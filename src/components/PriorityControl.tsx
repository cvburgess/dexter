import { SymbolView } from "expo-symbols";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ETaskPriority } from "@/api/tasks";
import { useTheme, withOpacity } from "@/utils/theme";

type TPriorityControlProps = {
  priority: ETaskPriority;
  onChangePriority: (priority: ETaskPriority) => void;
};

/** Ported from dexter-app's `PriorityButton` icons (Fire/Star/Alarm/Umbrella). */
const OPTIONS = [
  {
    label: "Important & Urgent",
    value: ETaskPriority.IMPORTANT_AND_URGENT,
    ios: "flame",
    material: "local_fire_department",
  },
  {
    label: "Important",
    value: ETaskPriority.IMPORTANT,
    ios: "star",
    material: "star",
  },
  {
    label: "Urgent",
    value: ETaskPriority.URGENT,
    ios: "alarm",
    material: "alarm",
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
        // NEITHER's priority color is the card color (invisible on the
        // background), so it renders in the text color instead.
        const iconColor =
          option.value === ETaskPriority.NEITHER
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
                backgroundColor: withOpacity(theme.colors.text, 0.1),
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
