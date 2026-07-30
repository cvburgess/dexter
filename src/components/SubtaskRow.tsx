import { StyleSheet, Text, View } from "react-native";

import { ETaskStatus, TSubtask } from "@/api/tasks";
import { SUBTASK_TITLE_MAX_LENGTH } from "@/utils/subtasks";
import { isCompletionStatus } from "@/utils/taskFilters";
import { useTheme, withOpacity } from "@/utils/theme";

import { EditableText } from "./EditableText";
import { IconMenu } from "./IconMenu";
import type { TIconMenuSection } from "./IconMenu.types";
import { StatusButton } from "./StatusButton";
import { subtaskGeometry } from "./SubtaskConnector";

// The icons are hoisted; the sections themselves close over the row's callbacks
// and so are rebuilt per render. That allocation is trivial next to the native
// menu host each row mounts, which is the cost that actually scales.
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
  onChangeStatus: (status: ETaskStatus) => void;
  onPromote: () => void;
  onDelete: () => void;
  /**
   * Whether the row's controls respond. False for a completed parent, whose
   * checklist is frozen — and which also drops two native menu hosts per row
   * from a card that can no longer act on them.
   */
  interactive?: boolean;
};

/**
 * One checklist item inside its parent's card. A subtask is not a task and is
 * deliberately not rendered as one — it has a status, a title, and nothing else.
 *
 * Actions hang off an explicit `⋯` button rather than a long-press. The card is
 * already wrapped in a long-press menu host (`MoreMenu`), and nesting a second
 * long-press host inside it is the fragile arrangement; a *tap*-triggered menu
 * nested inside the card is the pattern `StatusButton` already proves works.
 */
export function SubtaskRow({
  subtask,
  contentColor,
  editing,
  onStartEdit,
  onCommitTitle,
  onSubmit,
  onChangeStatus,
  onPromote,
  onDelete,
  interactive = true,
}: TSubtaskRowProps) {
  const theme = useTheme();
  const { statusSize, rowHeight } = subtaskGeometry(theme);
  const isComplete = isCompletionStatus(subtask.status);
  // Like StatusButton, the native menu host is pinned to its trigger's exact
  // size — an unpinned host reports 0 height while sizing and collapses the row.
  const box = { height: statusSize, width: statusSize };

  return (
    <View
      style={[
        styles.row,
        {
          // Wider than the parent row's `sm`: the checklist is inset so the
          // subtask circles center under the parent's larger ones, and the extra
          // gap gives that back, so subtask titles start on the parent title's
          // left edge.
          gap: theme.space.md,
          minHeight: rowHeight,
        },
      ]}
      testID={`subtask-row-${subtask.id}`}
    >
      <StatusButton
        status={subtask.status}
        contentColor={contentColor}
        size={statusSize}
        accessibilityLabel="Subtask status"
        interactive={interactive}
        onChangeStatus={onChangeStatus}
      />
      <EditableText
        value={subtask.title}
        editing={editing}
        editable={interactive && !isComplete}
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
            textDecorationLine: isComplete ? "line-through" : "none",
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
              {
                // Circled like StatusButton, at the same diameter, so the row's
                // two controls read as a pair and both sit subordinate to the
                // parent's.
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
