import { StyleSheet, Text, View } from "react-native";

import { TTask } from "@/api/tasks";
import { WEEK_COLUMN_MIN_WIDTH } from "@/utils/breakpoints";
import { useTheme } from "@/utils/theme";

type TTaskCardPreviewProps = {
  task: TTask;
  /** The dragged row's measured width, so the preview matches what was picked up. */
  width?: number;
};

/**
 * A static, non-interactive stand-in for a `TaskCard`: the priority-colored
 * shell and the title, nothing else.
 *
 * This is the thing that follows the finger during a drag (DEX-77), and it
 * exists because drax's default hover re-renders the dragged view's *children*
 * into its overlay. Here that would mount a second copy of every `@expo/ui`
 * menu host on the card — `MoreMenu` wraps it, and `StatusButton` and the
 * subtask rows each host one. Those size asynchronously and report 0 on native
 * (the same behaviour `TaskCard`'s own `minHeight` floor guards against), so
 * the duplicate painted nothing and the card appeared to teleport to the drop
 * target rather than travel there. Web was unaffected — duplicating DOM is
 * free — which is exactly why this needs a comment rather than a bug report.
 *
 * Nothing in here may be an `@expo/ui` host, a text input, or a pressable. It
 * is a picture of a card, not a card.
 *
 * It deliberately renders a *likeness* rather than reproducing `TaskCard` —
 * no status button, no due-date badge, no subtasks — so the two are not worth
 * unifying behind a shared shell. The fill, radius, padding and height floor are
 * read from the same tokens `TaskCard` uses, though, so a change there wants a
 * glance at this file. There is no completed-task branch because a finished card
 * can't be dragged (see `DraggableTaskCard`).
 */
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
          // Drax's hover wrapper is `alignSelf: "flex-start"`, so it shrink-wraps
          // its content. A `stretch` child of a shrink-wrapped Yoga parent with
          // no resolved width collapses to zero on native — web sized it from the
          // intrinsic text width, so this only ever broke on device. The measured
          // width is the real fix; the floor is what keeps the preview a card
          // rather than a sliver if the measurement hasn't landed yet, and
          // `WEEK_COLUMN_MIN_WIDTH` is exactly "the narrowest a card is drawn".
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
