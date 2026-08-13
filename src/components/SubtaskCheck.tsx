import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/utils/theme";

import { subtaskGeometry } from "./SubtaskConnector";

type TSubtaskCheckProps = {
  done: boolean;
  /** The circle's outline. Callers derive it from whatever they are drawn on. */
  borderColor: string;
  /** The checkmark's color. Defaults to `borderColor`'s caller-side content color. */
  contentColor: string;
  /**
   * Toggles on tap. Omitted where the control is inert — a form row being
   * composed, or the frozen checklist of a completed task.
   */
  onToggle?: (done: boolean) => void;
  accessibilityLabel?: string;
};

/**
 * A subtask's checkbox: complete or incomplete, and nothing else (DEX-153).
 *
 * Deliberately not `StatusButton` at a smaller size, which is what this was
 * until subtasks lost their statuses. That control exists to open a five-option
 * menu; a checklist item toggles on one tap, and routing that through a menu is
 * both slower for the user and a native menu host per row for the card to mount.
 *
 * It keeps `StatusButton`'s look — a bordered circle at `subtaskGeometry`'s
 * `statusSize`, glyph at half the diameter, "✓" being the same character the
 * status menu's Done option draws — so a checklist still reads as subordinate to
 * the parent circle above it rather than as a different kind of thing.
 */
export function SubtaskCheck({
  done,
  borderColor,
  contentColor,
  onToggle,
  accessibilityLabel = "Subtask complete",
}: TSubtaskCheckProps) {
  const theme = useTheme();
  const { statusSize } = subtaskGeometry(theme);

  const circle = (
    <View
      style={[
        styles.check,
        {
          borderColor,
          borderRadius: theme.radii.full,
          height: statusSize,
          width: statusSize,
        },
      ]}
    >
      {done && (
        <Text style={{ color: contentColor, fontSize: statusSize / 2 }}>✓</Text>
      )}
    </View>
  );

  if (!onToggle) return circle;

  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: done }}
      onPress={() => onToggle(!done)}
    >
      {circle}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  check: {
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
  },
});
