import { StyleSheet, Text, View } from "react-native";

import { TSubtask } from "@/api/tasks";
import { SUBTASK_TITLE_MAX_LENGTH } from "@/utils/subtasks";
import { useTheme, withOpacity } from "@/utils/theme";

import { EditableText } from "./EditableText";
import { IconMenu } from "./IconMenu";
import type { TIconMenuSection } from "./IconMenu.types";
import { SubtaskCheck } from "./SubtaskCheck";
import { subtaskGeometry } from "./SubtaskConnector";

// Icons hoisted; sections rebuild per render (closes over callbacks) — trivial
// next to the native menu host each row mounts.
const PROMOTE_ICON = {
  sf: "arrow.up.forward.square",
  ionicon: "open-outline",
} as const;
const DELETE_ICON = { sf: "trash", ionicon: "trash-outline" } as const;

const actionSections = (
  onPromote: () => void,
  onDelete: () => void,
): TIconMenuSection[] => [
  {
    options: [
      {
        id: "promote",
        title: "Promote to task",
        icon: PROMOTE_ICON,
        onSelect: onPromote,
      },
      {
        id: "delete",
        title: "Delete",
        icon: DELETE_ICON,
        isDestructive: true,
        onSelect: onDelete,
      },
    ],
  },
];

type TSubtaskRowProps = {
  subtask: TSubtask;
  contentColor: string;
  editing: boolean;
  onStartEdit: () => void;
  onCommitTitle: (title: string) => void;
  onSubmit?: (title: string) => void;
  onToggleDone: (done: boolean) => void;
  onPromote: () => void;
  onDelete: () => void;
  /** False for a completed parent — frozen checklist, no menu host mounted. */
  interactive?: boolean;
};

// Not rendered as a task. Tap-triggered `⋯`, not long-press — the card is
// already wrapped in MoreMenu's long-press host.
export function SubtaskRow({
  subtask,
  contentColor,
  editing,
  onStartEdit,
  onCommitTitle,
  onSubmit,
  onToggleDone,
  onPromote,
  onDelete,
  interactive = true,
}: TSubtaskRowProps) {
  const theme = useTheme();
  const { statusSize, rowHeight } = subtaskGeometry(theme);
  // Like StatusButton, the native menu host is pinned to its trigger's exact
  // size — an unpinned host reports 0 height while sizing and collapses the row.
  const box = { height: statusSize, width: statusSize };

  return (
    <View
      style={[
        styles.row,
        // Wider than the parent row's `sm` — the checklist inset shifts the
        // circles, and this gap gives subtask titles back the parent's edge.
        {
          gap: theme.space.md,
          minHeight: rowHeight,
        },
      ]}
      testID={`subtask-row-${subtask.id}`}
    >
      <SubtaskCheck
        done={subtask.done}
        borderColor={withOpacity(contentColor, 0.25)}
        contentColor={contentColor}
        onToggle={interactive ? onToggleDone : undefined}
      />
      <EditableText
        value={subtask.title}
        editing={editing}
        editable={interactive && !subtask.done}
        maxLength={SUBTASK_TITLE_MAX_LENGTH}
        onStartEdit={onStartEdit}
        onCommit={onCommitTitle}
        onSubmit={onSubmit}
        placeholder="Subtask"
        testID={`subtask-title-${subtask.id}`}
        style={[
          theme.fonts.body,
          {
            color: contentColor,
            textDecorationLine: subtask.done ? "line-through" : "none",
          },
        ]}
      />
      {!interactive ? null : (
        <IconMenu
          accessibilityLabel="Subtask actions"
          style={box}
          sections={actionSections(onPromote, onDelete)}
        >
          <View
            style={[
              styles.menuTrigger,
              box,
              // Circled like StatusButton at the same diameter, so the two
              // controls read as a pair.
              {
                borderColor: withOpacity(contentColor, 0.25),
                borderRadius: theme.radii.full,
              },
            ]}
          >
            <Text
              style={[
                theme.fonts.title,
                { color: withOpacity(contentColor, 0.6) },
              ]}
            >
              ⋯
            </Text>
          </View>
        </IconMenu>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
  menuTrigger: {
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
  },
});
