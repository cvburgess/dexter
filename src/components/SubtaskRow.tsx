import { StyleSheet, Text, View } from "react-native";

import { ETaskStatus, TSubtask } from "@/api/tasks";
import { isCompletionStatus } from "@/utils/taskFilters";
import { withOpacity } from "@/utils/theme";

import { EditableText } from "./EditableText";
import { IconMenu } from "./IconMenu";
import type { TIconMenuSection } from "./IconMenu.types";
import { StatusButton } from "./StatusButton";

// Subordinate to the parent's 32px status button, so the nesting reads at a
// glance without needing a connector rail. Also the size the `⋯` menu host is
// pinned to, hence one constant rather than a literal per call site.
const STATUS_SIZE = 24;

// Everything but the two callbacks is constant, and each subtask row mounts its
// own native menu host — so the descriptors are built once here rather than
// re-allocated per row on every render of the card.
const PROMOTE_ICON = {
  ios: "arrow.up.forward.square",
  android: "open_in_new",
  web: "open_in_new",
} as const;
const DELETE_ICON = { ios: "trash", android: "delete", web: "delete" } as const;

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
}: TSubtaskRowProps) {
  const isComplete = isCompletionStatus(subtask.status);

  return (
    <View style={styles.row} testID={`subtask-row-${subtask.id}`}>
      <StatusButton
        status={subtask.status}
        contentColor={contentColor}
        size={STATUS_SIZE}
        accessibilityLabel="Subtask status"
        onChangeStatus={onChangeStatus}
      />
      <EditableText
        value={subtask.title}
        editing={editing}
        editable={!isComplete}
        onStartEdit={onStartEdit}
        onCommit={onCommitTitle}
        onSubmit={onSubmit}
        placeholder="Subtask"
        testID={`subtask-title-${subtask.id}`}
        style={[
          styles.title,
          {
            color: contentColor,
            textDecorationLine: isComplete ? "line-through" : "none",
          },
        ]}
      />
      <IconMenu
        accessibilityLabel="Subtask actions"
        style={styles.menu}
        sections={actionSections(onPromote, onDelete)}
      >
        <View style={styles.menuTrigger}>
          <Text
            style={[
              styles.menuGlyph,
              { color: withOpacity(contentColor, 0.6) },
            ]}
          >
            ⋯
          </Text>
        </View>
      </IconMenu>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 32,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: "400",
  },
  // Like StatusButton, the native menu host is pinned to its trigger's exact
  // size — an unpinned host reports 0 height while sizing and collapses the row.
  menu: {
    height: STATUS_SIZE,
    width: STATUS_SIZE,
  },
  menuTrigger: {
    alignItems: "center",
    height: STATUS_SIZE,
    justifyContent: "center",
    width: STATUS_SIZE,
  },
  menuGlyph: {
    fontSize: 16,
    fontWeight: "600",
  },
});
