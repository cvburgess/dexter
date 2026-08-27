import { StyleSheet, Text, View } from "react-native";

import { TTask } from "@/api/tasks";
import { WEEK_COLUMN_MIN_WIDTH } from "@/utils/breakpoints";
import { useTheme } from "@/utils/theme";

type TTaskCardPreviewProps = {
  task: TTask;
  /** The dragged row's measured width, so the preview matches what was picked up. */
  width?: number;
};

// The drag preview (DEX-77): drax's default hover re-renders the dragged
// children, which would mount a second async-sizing @expo/ui host per card
// and paint nothing on native. Nothing here may be a host, input, or pressable.
export function TaskCardPreview({ task, width }: TTaskCardPreviewProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.priorityMuted[task.priority],
          borderRadius: theme.radii.md,
          minHeight: theme.space.md * 2 + theme.controls.sm,
          padding: theme.space.md,
          // Drax's shrink-wrapped hover wrapper collapses a stretch child to
          // zero on native; floors this as a card until the real width lands.
          width: width ?? WEEK_COLUMN_MIN_WIDTH,
        },
      ]}
      testID={`task-card-preview-${task.id}`}
    >
      <Text
        numberOfLines={2}
        style={[
          theme.fonts.body,
          { color: theme.colors.priorityContent[task.priority] },
        ]}
      >
        {task.title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
    justifyContent: "center",
    overflow: "hidden",
  },
});
