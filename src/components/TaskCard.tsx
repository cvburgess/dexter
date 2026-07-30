import { useState } from "react";
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
import { useConfirmation } from "@/hooks/useConfirmation";
import { isCompletionStatus } from "@/utils/taskFilters";
import { useTheme, withOpacity } from "@/utils/theme";

import { ConfirmationModal } from "./ConfirmationModal";
import { DueDateButton } from "./DueDateButton";
import { EditableText } from "./EditableText";
import { ListButton } from "./ListButton";
import { MoreMenu } from "./MoreMenu";
import { StatusButton } from "./StatusButton";
import { subtaskGeometry, SubtaskConnectors } from "./SubtaskConnector";
import { SubtaskRow } from "./SubtaskRow";

// Matches dexter-app's cardColors: incomplete cards sit on the priority color
// muted toward the surface (`colors.priorityMuted`, pre-blended in theme.ts);
// complete cards fade the raw color to a 3% tint with muted (25% opacity) text,
// regardless of priority. The complete tint stays an alpha deliberately — it is
// meant to read as *absence* of a card, not as a fourth surface color.
const COMPLETE_OPACITY = 0.03;
const COMPLETE_TEXT_OPACITY = 0.25;

/** Which row, if any, is currently in inline-edit mode. */
type TEditing = { kind: "title" } | { kind: "subtask"; id: string } | null;

/**
 * A rename that has been committed but whose write hasn't reached the cache
 * yet. Leaving edit mode is synchronous, while the optimistic write is a tick
 * behind it — so without this the pre-edit title paints in between and the old
 * text visibly blinks back before the new one settles.
 *
 * One slot, because `editing` is one slot: only a single row can be renaming.
 */
type TRenamed =
  | { kind: "title"; from: string; to: string }
  | { kind: "subtask"; id: string; from: string; to: string };

type TTaskCardProps = {
  task: TTask;
  onUpdate: (diff: Omit<TUpdateTask, "id">) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /**
   * Creates the task a promoted subtask becomes; mirrors how `onDuplicate`
   * defers creation upward. Required, not optional: promotion removes the
   * subtask from its parent, so a host that didn't wire this would silently
   * delete the subtask and create nothing in its place.
   */
  onPromoteSubtask: (task: TCreateTask) => void;
  /**
   * Turns the title into a link instead of a rename affordance — the Search
   * tab's results open the task rather than editing it in place (DEX-47).
   *
   * Only the title changes. `StatusButton`, the date/list buttons, the subtask
   * rows, and the long-press `MoreMenu` all keep working, so a result can still
   * be checked off or rescheduled without leaving Search.
   */
  onPress?: () => void;
};

export function TaskCard({
  task,
  onUpdate,
  onDuplicate,
  onDelete,
  onPromoteSubtask,
  onPress,
}: TTaskCardProps) {
  const theme = useTheme();
  const checklist = subtaskGeometry(theme);
  const [editing, setEditing] = useState<TEditing>(null);
  const { confirm, confirmationProps } = useConfirmation();
  const isComplete = isCompletionStatus(task.status);

  // Rows this card has created that the cache hasn't confirmed yet: the empty
  // one "Add subtask" is showing, plus any just committed whose write is still
  // in flight. A list rather than a single slot because return chains a fresh
  // row while the one before it is still unconfirmed. Everything else reads
  // straight from `task.subtasks`, so a change arriving from another device is
  // never masked.
  // Always updated through the function form: a row that unmounts commits from
  // *its* last-render closure, which can hold a list two taps out of date, and
  // replacing the list wholesale from there would drop whatever arrived since.
  const [unconfirmed, setUnconfirmed] = useState<TSubtask[]>([]);

  const [renamed, setRenamed] = useState<TRenamed | null>(null);
  if (renamed !== null) {
    const current =
      renamed.kind === "title"
        ? task.title
        : task.subtasks.find((subtask) => subtask.id === renamed.id)?.title;
    // The prop is authoritative again the moment it moves off what we renamed
    // *from* — whether that's the optimistic write landing or a failure rolling
    // it back. Derived during render, not in an effect, so the overlay never
    // outlives the frame that makes it redundant.
    if (current !== renamed.from) setRenamed(null);
  }

  // Display-only overlays. Every write still composes from `task.subtasks`, so
  // an in-flight rename can never be folded into the next update as if it were
  // server state.
  const title = renamed?.kind === "title" ? renamed.to : task.title;
  const renamedRows =
    renamed?.kind === "subtask"
      ? task.subtasks.map((subtask) =>
          subtask.id === renamed.id
            ? { ...subtask, title: renamed.to }
            : subtask,
        )
      : task.subtasks;

  // A row drops out of the local list the moment the cache has it. Derived
  // during render, like the rename above, so it is never rendered twice — once
  // from the cache and once from here — even for a single frame.
  const unsettled = unconfirmed.filter(
    (row) => !task.subtasks.some((subtask) => subtask.id === row.id),
  );
  if (unsettled.length !== unconfirmed.length) setUnconfirmed(unsettled);

  const subtasks = [...renamedRows, ...unsettled];

  /**
   * Clear edit mode only if the row named still owns it. React runs the
   * outgoing row's unmount cleanup *after* `editing` has already moved to the
   * row the user just tapped, so clearing blindly cancels the edit they are
   * starting — and the tap reads as having done nothing at all.
   */
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

    // A row the cache doesn't have yet is one this card created — so whether
    // this is an append or an edit is decided by server state, never by how
    // stale this closure's copy of the local list happens to be. Once the cache
    // owns the row, this is an ordinary rename and never a second append.
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
      // Kept on screen carrying the title just committed, rather than dropped
      // to wait for the write — dropping it blinks the whole row out of the
      // checklist and back in. It clears itself once the cache confirms it.
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

  // An alarm is bound to the task's scheduled date (it fires at scheduled_for +
  // alarm_time), so changing that date shouldn't silently move or orphan it —
  // ask first. A re-tap of the current day changes nothing, and a task without
  // an alarm just reschedules (DEX-48). `== null` (not `===`) so a task whose
  // `alarmTime` is absent rather than null — e.g. a DB missing the column —
  // still counts as "no alarm" and reschedules directly instead of prompting.
  const handleChangeSchedule = async (scheduledFor: string | null) => {
    const scheduleChanged = scheduledFor !== task.scheduledFor;

    if (task.alarmTime == null || !scheduleChanged) {
      onUpdate({ scheduledFor });
      return;
    }

    if (scheduledFor === null) {
      // Unscheduling removes the date the alarm needs to fire, so keeping it
      // isn't an option — only unset-or-cancel.
      const confirmed = await confirm({
        title: "Unschedule task?",
        message:
          "This task has an alarm set. Unscheduling it will unset the alarm.",
        confirmLabel: "Unschedule",
        destructive: true,
      });
      if (confirmed) onUpdate({ scheduledFor: null, alarmTime: null });
      return;
    }

    // Moving to another day: let the user carry the alarm to the new day (same
    // time) or drop it. Each choice applies itself; Cancel leaves the task as-is.
    await confirm({
      title: "Reschedule task?",
      message:
        "This task has an alarm set. Keep the alarm on the new day, or unset it?",
      actions: [
        {
          label: "Keep alarm",
          role: "default",
          onPress: () => onUpdate({ scheduledFor }),
        },
        {
          label: "Unset alarm",
          role: "destructive",
          onPress: () => onUpdate({ scheduledFor, alarmTime: null }),
        },
        { label: "Cancel", role: "cancel" },
      ],
    });
  };

  const priorityColor = theme.colors.priority[task.priority];
  // The color everything on the card (title, button outlines/icons, border)
  // is drawn in — matches dexter-app's Card.tsx, which derives all of it
  // from the priority's "-content" color, muted to `text` when done.
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
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          // Floor of padding (×2) + the inline control height. A completed
          // card's only height-defining child is the StatusButton's native menu
          // host, whose async sizing can transiently report 0 — without this
          // floor the row (or a whole list of completed tasks) collapses blank.
          // A floor, not a fixed height, so multi-line titles and subtasks can
          // still grow the card.
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
          // Renaming a finished task is disabled, matching the buttons below.
          // No `&& !onPress` here — `EditableText` already gives `onPress`
          // precedence over `editable`, and stating it twice would let a future
          // change to one site read as contradicting the other.
          editable={!isComplete}
          onPress={onPress}
          onStartEdit={() => setEditing({ kind: "title" })}
          onCommit={(committed) => {
            stopEditingTitle();
            // An emptied title reverts rather than wiping the task — a task with
            // no title would be unidentifiable and unrecoverable from the list.
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
        {!isComplete && (
          <>
            <DueDateButton
              dueOn={task.dueOn}
              priorityColor={priorityColor}
              contentColor={contentColor}
            />
            {task.listId !== null && (
              <ListButton
                listId={task.listId}
                contentColor={contentColor}
                onChangeList={(listId) => onUpdate({ listId })}
              />
            )}
          </>
        )}
      </View>
      {subtasks.length > 0 && (
        <View
          style={[
            {
              gap: checklist.gap,
              // Not indented: the checklist runs the full width of the title
              // row, so a subtask's controls sit directly under the parent's,
              // both columns of circles on the same vertical axes.
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
              // A completed parent's checklist is frozen: the sweep just closed
              // every row, and re-opening one would restore exactly the
              // done-parent-with-open-children state the sweep exists to prevent.
              interactive={!isComplete}
              onChangeStatus={(status) =>
                onUpdate({
                  subtasks: task.subtasks.map((current) =>
                    current.id === subtask.id
                      ? { ...current, status }
                      : current,
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

  // Priority/schedule/list editing (and the long-press that opens it) isn't
  // available once a task reaches a terminal status, matching the buttons above.
  if (isComplete) return card;

  return (
    <>
      <MoreMenu
        task={task}
        onChangePriority={(priority) => onUpdate({ priority })}
        onChangeSchedule={handleChangeSchedule}
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
    // Both branches stretch to the list width so the row measures its natural
    // single-line height (the complete branch renders without the MoreMenu
    // wrapper that would otherwise supply the stretch).
    alignSelf: "stretch",
    borderWidth: 1,
    // A column now: the title row, then the checklist stacked beneath it.
    flexDirection: "column",
    overflow: "hidden",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
  },
});
