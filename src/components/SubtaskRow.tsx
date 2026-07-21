import { StyleSheet, Text, View } from "react-native";

import { ETaskStatus, TSubtask } from "@/api/tasks";
import { withOpacity } from "@/utils/theme";

import { EditableText } from "./EditableText";
import { IconMenu } from "./IconMenu";
import { StatusButton } from "./StatusButton";

// Subordinate to the parent's 32px status button, so the nesting reads at a
// glance without needing a connector rail.
const STATUS_SIZE = 24;

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
  const isComplete =
    subtask.status === ETaskStatus.DONE ||
    subtask.status === ETaskStatus.WONT_DO;

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
        sections={[
          {
            options: [
              {
                id: "promote",
                title: "Promote to task",
                icon: {
                  ios: "arrow.up.forward.square",
                  android: "open_in_new",
                  web: "open_in_new",
                },
                onSelect: onPromote,
              },
              {
                id: "delete",
                title: "Delete",
                icon: { ios: "trash", android: "delete", web: "delete" },
                isDestructive: true,
                onSelect: onDelete,
              },
            ],
          },
        ]}
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
    height: 24,
    width: 24,
  },
  menuTrigger: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  menuGlyph: {
    fontSize: 16,
    fontWeight: "600",
  },
});
