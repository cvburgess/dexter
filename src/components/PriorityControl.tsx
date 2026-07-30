import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ETaskPriority } from "@/api/tasks";
import { Theme, useTheme } from "@/utils/theme";

import { Icon } from "./Icon";

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
    icon: { sf: "alarm", ionicon: "alarm-outline" },
  },
  {
    label: "Important",
    value: ETaskPriority.IMPORTANT,
    icon: { sf: "star", ionicon: "star-outline" },
  },
  {
    label: "Important & Urgent",
    value: ETaskPriority.IMPORTANT_AND_URGENT,
    icon: { sf: "flame", ionicon: "flame-outline" },
  },
  {
    label: "Neither",
    value: ETaskPriority.NEITHER,
    icon: { sf: "umbrella", ionicon: "umbrella-outline" },
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
 * The fill and icon color of a *selected* option. NEITHER inverts for the same
 * reason its icon does: its priority color is the card color, which is all but
 * invisible against the form background, and its content color is the text
 * color the icon already carries unselected — so filling with one and drawing
 * with the other leaves the option looking untouched. Swapping the pair gives
 * it a filled chip like every other priority.
 */
export const prioritySelectedColors = (
  value: ETaskPriority,
  theme: Theme,
): { background: string; content: string } =>
  value === ETaskPriority.NEITHER
    ? {
        background: theme.colors.priorityContent[value],
        content: theme.colors.priority[value],
      }
    : {
        background: theme.colors.priority[value],
        content: theme.colors.priorityContent[value],
      };

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
        const selected = prioritySelectedColors(option.value, theme);
        const iconColor = isSelected
          ? selected.content
          : priorityIconColor(option.value, theme);

        return (
          <TouchableOpacity
            accessibilityLabel={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={option.value}
            style={[
              styles.option,
              {
                borderRadius: theme.radii.full,
                // Wider than it is tall, so four chips read as one segmented
                // control rather than four circles.
                paddingHorizontal: theme.space.md,
                paddingVertical: theme.space.sm,
              },
              isSelected && { backgroundColor: selected.background },
            ]}
            onPress={() =>
              onChangePriority(
                isSelected ? ETaskPriority.UNPRIORITIZED : option.value,
              )
            }
          >
            <Icon {...option.icon} color={iconColor} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
