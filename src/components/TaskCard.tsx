import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  appendSubtask,
  promoteSubtaskInput,
  removeSubtask,
  TCreateTask,
  TSubtask,
  TTask,
  TUpdateTask,
} from "@/api/tasks";
import { useScheduleChange } from "@/hooks/useScheduleChange";
import { isCompletionStatus } from "@/utils/taskFilters";
import { useTheme, withOpacity } from "@/utils/theme";

import { ConfirmationModal } from "./ConfirmationModal";
import { DueDateButton } from "./DueDateButton";
import { EditableText } from "./EditableText";
import { MoreMenu } from "./MoreMenu";
import { StatusButton } from "./StatusButton";
import { subtaskGeometry, SubtaskConnectors } from "./SubtaskConnector";
import { SubtaskRow } from "./SubtaskRow";

// Matches dexter-app's cardColors; complete cards fade to a 3% tint to read
// as *absence* of a card. No outline (DEX-114) — a hairline read as an edge.
const COMPLETE_OPACITY = 0.03;
const COMPLETE_TEXT_OPACITY = 0.25;

/** Which row, if any, is currently in inline-edit mode. */
type TEditing = { kind: "title" } | { kind: "subtask"; id: string } | null;

// A committed rename whose write hasn't reached the cache — without this the
// pre-edit title blinks back for a frame before the optimistic write settles.
type TRenamed =
  | { kind: "title"; from: string; to: string }
  | { kind: "subtask"; id: string; from: string; to: string };

type TTaskCardProps = {
  task: TTask;
  onUpdate: (diff: Omit<TUpdateTask, "id">) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Creates the task a promoted subtask becomes. Required — promotion
   * removes the subtask from its parent, so an unwired host loses it. */
  onPromoteSubtask: (task: TCreateTask) => void;
  /** Turns the title into a link for Search results (DEX-47); only the
   * title changes, everything else keeps working without leaving Search. */
  onPress?: () => void;
  /** Fires when an inline rename opens/closes. DraggableTaskCard uses it to
   * suspend the drag while focused — web's drag has no hold at all (DEX-77). */
  onEditingChange?: (editing: boolean) => void;
};

export function TaskCard({
  task,
  onUpdate,
  onDuplicate,
  onDelete,
  onPromoteSubtask,
  onPress,
  onEditingChange,
}: TTaskCardProps) {
  const theme = useTheme();
  const checklist = subtaskGeometry(theme);
  const [editing, setEditing] = useState<TEditing>(null);
  // Lives in the hook so every rescheduling surface prompts identically
  // (DEX-77); `id` drops since `onUpdate` is already bound to this task.
  const { changeSchedule, confirmationProps } = useScheduleChange(
    ({ id: _id, ...diff }) => onUpdate(diff),
  );
  const isComplete = isCompletionStatus(task.status);

  // From an effect, not each of the four setEditing sites. Keyed on the
  // boolean so moving between subtask rows doesn't churn it.
  const isEditing = editing !== null;
  useEffect(() => {
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  // A list, since return chains a fresh row while the one before is still
  // unconfirmed. Function-form setter: an unmounting row's closure is stale.
  const [unconfirmed, setUnconfirmed] = useState<TSubtask[]>([]);

  const [renamed, setRenamed] = useState<TRenamed | null>(null);
  if (renamed !== null) {
    const current =
      renamed.kind === "title"
        ? task.title
        : task.subtasks.find((subtask) => subtask.id === renamed.id)?.title;
    // Authoritative again once the prop moves off `from` — write landed or
    // rolled back. Derived during render so the overlay never outlives it.
    if (current !== renamed.from) setRenamed(null);
  }

  // Display-only overlays — every write still composes from task.subtasks, so
  // an in-flight rename is never folded into the next update as server state.
  const title = renamed?.kind === "title" ? renamed.to : task.title;
  const renamedRows =
    renamed?.kind === "subtask"
      ? task.subtasks.map((subtask) =>
          subtask.id === renamed.id
            ? { ...subtask, title: renamed.to }
            : subtask,
        )
      : task.subtasks;

  // A row drops out the moment the cache has it — derived during render so it
  // is never rendered twice, even for one frame.
  const unsettled = unconfirmed.filter(
    (row) => !task.subtasks.some((subtask) => subtask.id === row.id),
  );
  if (unsettled.length !== unconfirmed.length) setUnconfirmed(unsettled);

  const subtasks = [...renamedRows, ...unsettled];

  // Clear only if this row still owns it — unmount cleanup runs *after*
  // `editing` moved to the row just tapped, so clearing blindly cancels it.
  const stopEditingTitle = () =>
    setEditing((current) => (current?.kind === "title" ? null : current));

  const stopEditingSubtask = (id: string) =>
    setEditing((current) =>
      current?.kind === "subtask" && current.id === id ? null : current,
    );

  const addSubtask = () => {
    const [row] = appendSubtask([]);
    // Drop any row still left untitled — the same rule its own commit applies,
    // just applied now, so tapping "Add subtask" twice never stacks up empties.
    setUnconfirmed((rows) => [
      ...rows.filter(({ title }) => title !== ""),
      row,
    ]);
    setEditing({ kind: "subtask", id: row.id });
  };

  const commitSubtaskTitle = (id: string, title: string) => {
    stopEditingSubtask(id);

    // Whether this is an append or edit is decided by server state, never by
    // how stale this closure's local-list copy is.
    const unconfirmedRow = task.subtasks.some((subtask) => subtask.id === id)
      ? undefined
      : unconfirmed.find((row) => row.id === id);
    if (unconfirmedRow) {
      // An untitled row is discarded, never written: `title: ""` would fail the
      // MCP server's validation and disable that task's sweep permanently.
      if (title === "") {
        setUnconfirmed((rows) => rows.filter((row) => row.id !== id));
        return;
      }
      // Kept on screen with the committed title rather than dropped to wait
      // for the write — else the whole row blinks out and back in.
      setUnconfirmed((rows) =>
        rows.map((row) => (row.id === id ? { ...row, title } : row)),
      );
      onUpdate({ subtasks: [...task.subtasks, { ...unconfirmedRow, title }] });
      return;
    }

    // An emptied existing title reverts — a titleless subtask would be
    // unidentifiable — so there is simply nothing to write.
    if (title === "") return;

    const from = task.subtasks.find((subtask) => subtask.id === id)?.title;
    if (from !== undefined && from !== title)
      setRenamed({ kind: "subtask", id, from, to: title });

    onUpdate({
      subtasks: task.subtasks.map((subtask) =>
        subtask.id === id ? { ...subtask, title } : subtask,
      ),
    });
  };

  const handlePromoteSubtask = (subtask: TSubtask) => {
    onPromoteSubtask(promoteSubtaskInput(task, subtask));
    onUpdate({ subtasks: removeSubtask(task.subtasks, subtask.id) });
  };

  const priorityColor = theme.colors.priority[task.priority];
  // Everything on the card draws in this — matches dexter-app's Card.tsx,
  // muted to `text` when done.
  const contentColor = isComplete
    ? withOpacity(theme.colors.text, COMPLETE_TEXT_OPACITY)
    : theme.colors.priorityContent[task.priority];

  const card = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isComplete
            ? withOpacity(priorityColor, COMPLETE_OPACITY)
            : theme.colors.priorityMuted[task.priority],
          borderRadius: theme.radii.md,
          // Floor, not fixed height: a completed card's only height-defining
          // child is StatusButton's async-sizing menu host, which can report 0.
          minHeight: theme.space.md * 2 + theme.controls.sm,
          padding: theme.space.md,
        },
      ]}
      testID={`task-card-${task.id}`}
    >
      <View style={[styles.titleRow, { gap: theme.space.sm }]}>
        <StatusButton
          status={task.status}
          contentColor={contentColor}
          onChangeStatus={(status) => onUpdate({ status })}
        />
        <EditableText
          value={title}
          editing={editing?.kind === "title"}
          // No `&& !onPress` — EditableText already gives onPress precedence.
          editable={!isComplete}
          numberOfLines={2}
          onPress={onPress}
          onStartEdit={() => setEditing({ kind: "title" })}
          onCommit={(committed) => {
            stopEditingTitle();
            // An emptied title reverts — a titleless task is unrecoverable.
            if (!committed || committed === task.title) return;
            setRenamed({ kind: "title", from: task.title, to: committed });
            onUpdate({ title: committed });
          }}
          testID={`task-title-${task.id}`}
          style={[
            {
              ...theme.fonts.body,
              color: contentColor,
              textDecorationLine: isComplete ? "line-through" : "none",
            },
          ]}
        />
        {/* The list emoji used to sit here (ListButton, still tested);
            hidden not removed (DEX-113) — no emoji on the card is the point. */}
        {!isComplete && (
          <DueDateButton
            dueOn={task.dueOn}
            priorityColor={priorityColor}
            contentColor={contentColor}
            // A step beyond the row's gap (DEX-111): passed in, not baked into
            // the badge, which renders nothing with no due date.
            style={{ marginLeft: theme.space.sm }}
          />
        )}
      </View>
      {subtasks.length > 0 && (
        <View
          style={[
            {
              gap: checklist.gap,
              // Not indented: subtask controls sit directly under the
              // parent's, both circle columns on the same vertical axis.
              paddingHorizontal: checklist.inset,
              paddingTop: checklist.offset,
            },
          ]}
        >
          <SubtaskConnectors
            count={subtasks.length}
            color={withOpacity(contentColor, 0.25)}
          />
          {subtasks.map((subtask) => (
            <SubtaskRow
              key={subtask.id}
              subtask={subtask}
              contentColor={contentColor}
              editing={editing?.kind === "subtask" && editing.id === subtask.id}
              onStartEdit={() =>
                setEditing({ kind: "subtask", id: subtask.id })
              }
              onCommitTitle={(title) => commitSubtaskTitle(subtask.id, title)}
              // Return chains the next row; an empty commit ends the chain.
              onSubmit={(title) => {
                if (title) addSubtask();
              }}
              // Frozen once complete — reopening a row would restore the
              // done-parent-with-open-children state the sweep prevents.
              interactive={!isComplete}
              onToggleDone={(done) =>
                onUpdate({
                  subtasks: task.subtasks.map((current) =>
                    current.id === subtask.id ? { ...current, done } : current,
                  ),
                })
              }
              onPromote={() => handlePromoteSubtask(subtask)}
              onDelete={() =>
                onUpdate({ subtasks: removeSubtask(task.subtasks, subtask.id) })
              }
            />
          ))}
        </View>
      )}
    </View>
  );

  // Priority/schedule/list editing isn't available once terminal, matching
  // the buttons above.
  if (isComplete) return card;

  return (
    <>
      <MoreMenu
        task={task}
        onChangePriority={(priority) => onUpdate({ priority })}
        onChangeSchedule={(scheduledFor) => changeSchedule(task, scheduledFor)}
        onAddSubtask={addSubtask}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        style={styles.moreMenuWrapper}
      >
        {card}
      </MoreMenu>
      <ConfirmationModal {...confirmationProps} />
    </>
  );
}

const styles = StyleSheet.create({
  moreMenuWrapper: {
    alignSelf: "stretch",
  },
  container: {
    // Both branches stretch to the list width for a natural single-line
    // height — the complete branch has no MoreMenu wrapper to supply it.
    alignSelf: "stretch",
    flexDirection: "column",
    overflow: "hidden",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
  },
});
