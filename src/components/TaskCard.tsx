import { Temporal } from "@js-temporal/polyfill";
import { useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import {
  appendSubtask,
  ETaskStatus,
  promoteSubtaskInput,
  removeSubtask,
  TCreateTask,
  TSubtask,
  TTask,
  TUpdateTask,
} from "@/api/tasks";
import { useConfirmation } from "@/hooks/useConfirmation";
import { currentAlarmTime, requestAlarmAuthorization } from "@/utils/alarms";
import { useTheme, withOpacity } from "@/utils/theme";

import { ConfirmationModal } from "./ConfirmationModal";
import { DueDateButton } from "./DueDateButton";
import { EditableText } from "./EditableText";
import { ListButton } from "./ListButton";
import { MoreMenu } from "./MoreMenu";
import { SetAlarmModal } from "./SetAlarmModal";
import { StatusButton } from "./StatusButton";
import {
  SUBTASK_ROW_HEIGHT,
  SUBTASK_STATUS_SIZE,
  SubtaskRow,
} from "./SubtaskRow";

// Matches dexter-app's cardColors: incomplete cards sit on the priority color
// at 80% opacity; complete cards fade the same color to a 3% tint with muted
// (25% opacity) text, regardless of priority.
const INCOMPLETE_OPACITY = 0.8;
const COMPLETE_OPACITY = 0.03;
const COMPLETE_TEXT_OPACITY = 0.25;

// Checklist spacing. Constants rather than literals in the stylesheet because
// the connector rail is positioned from the same numbers — if the two drift,
// the line stops meeting the circles.
const SUBTASK_GAP = 2;
/** Between the title row and the first subtask. Padding, not margin, so the
 * rail's first segment starts inside the box it's positioned against. */
const SUBTASK_OFFSET = 8;
/** Half the difference between the parent's 32px buttons and a subtask's 24px
 * ones — the inset that puts both columns of circles on the same axes. */
const SUBTASK_INSET = 4;
/** Matches StatusButton's `borderWidth`, so the rail reads as the same stroke
 * as the circles it joins (its color matches their border opacity too). */
const CONNECTOR_WIDTH = 1;

/**
 * The rail segment linking one subtask's circle up to the circle above it (the
 * parent's, for the first row). Deliberately segments and not one continuous
 * line: the circles are transparent, so a full-length rail would be visible
 * straight through the middle of every one of them.
 */
const connectorSegment = (index: number) => {
  const circleInset = (SUBTASK_ROW_HEIGHT - SUBTASK_STATUS_SIZE) / 2;
  const top =
    SUBTASK_OFFSET + index * (SUBTASK_ROW_HEIGHT + SUBTASK_GAP) + circleInset;
  // The parent's circle fills its row, so its underside is the checklist's top
  // edge; a sibling's clears the gap and its own inset first.
  const previousBottom = index === 0 ? 0 : top - SUBTASK_GAP - circleInset * 2;
  return { height: top - previousBottom, top: previousBottom };
};

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
};

export function TaskCard({
  task,
  onUpdate,
  onDuplicate,
  onDelete,
  onPromoteSubtask,
}: TTaskCardProps) {
  const theme = useTheme();
  const [alarmModalVisible, setAlarmModalVisible] = useState(false);
  const [editing, setEditing] = useState<TEditing>(null);
  const { confirm, confirmationProps } = useConfirmation();
  const isComplete =
    task.status === ETaskStatus.DONE || task.status === ETaskStatus.WONT_DO;

  // The one not-yet-saved row: "Add subtask" shows an empty focused row before
  // anything is written, and an empty subtask is never persisted. Everything
  // else reads straight from `task.subtasks`, which `useTasks` keeps current
  // through its optimistic cache write — so there is no overlay to go stale,
  // and a change arriving from another device is never masked.
  const [pending, setPending] = useState<TSubtask | null>(null);

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
  const subtasks = pending ? [...renamedRows, pending] : renamedRows;

  // A row that unmounts commits from *its* last-render closure, which can name
  // a pending row that has since been replaced (tap "Add subtask" twice). The
  // ref is always current, so the commit can tell "I am the pending row" from
  // "I was the pending row" and avoid clearing someone else's.
  const pendingRef = useRef<TSubtask | null>(null);
  const setPendingRow = (row: TSubtask | null) => {
    pendingRef.current = row;
    setPending(row);
  };

  /** Clears edit mode only if this row still owns it — see `commitSubtaskTitle`. */
  const stopEditing = (id: string) =>
    setEditing((current) =>
      current?.kind === "subtask" && current.id === id ? null : current,
    );

  const addSubtask = () => {
    const [row] = appendSubtask([]);
    setPendingRow(row);
    setEditing({ kind: "subtask", id: row.id });
  };

  const commitSubtaskTitle = (id: string, title: string) => {
    // Not unconditional: React runs the outgoing row's unmount cleanup *after*
    // `editing` has already moved to the row the user just tapped, so clearing
    // blindly would cancel the edit they are starting.
    stopEditing(id);

    // The pending row is the only unsaved one, so its identity — not a search
    // through server state that may not have caught up — decides the rule.
    const pendingRow = pendingRef.current;
    if (pendingRow?.id === id) {
      setPendingRow(null);
      // An untitled row is discarded, never written: `title: ""` would fail the
      // MCP server's validation and disable that task's sweep permanently.
      if (title !== "")
        onUpdate({ subtasks: [...task.subtasks, { ...pendingRow, title }] });
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

  // Persist the picked alarm time. Alarms fire on the scheduled date, so an
  // unscheduled task is pulled onto today. AlarmKit needs permission before it
  // can ring, so a set that's denied is surfaced rather than silently stored.
  const handleConfirmAlarm = async (alarmTime: string) => {
    setAlarmModalVisible(false);

    const authorized = await requestAlarmAuthorization();
    if (!authorized) {
      Alert.alert(
        "Alarms are turned off",
        "Enable alarms for Dexter in Settings to be reminded at a set time.",
      );
      return;
    }

    onUpdate({
      alarmTime,
      ...(task.scheduledFor === null
        ? { scheduledFor: Temporal.Now.plainDateISO().toString() }
        : {}),
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
          backgroundColor: withOpacity(
            priorityColor,
            isComplete ? COMPLETE_OPACITY : INCOMPLETE_OPACITY,
          ),
          borderColor: withOpacity(contentColor, 0.1),
          borderRadius: theme.borderRadius,
        },
      ]}
      testID={`task-card-${task.id}`}
    >
      <View style={styles.titleRow}>
        <StatusButton
          status={task.status}
          contentColor={contentColor}
          onChangeStatus={(status) => onUpdate({ status })}
        />
        <EditableText
          value={title}
          editing={editing?.kind === "title"}
          // Renaming a finished task is disabled, matching the buttons below.
          editable={!isComplete}
          onStartEdit={() => setEditing({ kind: "title" })}
          onCommit={(committed) => {
            setEditing(null);
            // An emptied title reverts rather than wiping the task — a task with
            // no title would be unidentifiable and unrecoverable from the list.
            if (!committed || committed === task.title) return;
            setRenamed({ kind: "title", from: task.title, to: committed });
            onUpdate({ title: committed });
          }}
          testID={`task-title-${task.id}`}
          style={[
            styles.title,
            {
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
        <View style={styles.subtasks}>
          {subtasks.map((subtask, index) => (
            <View
              key={`connector-${subtask.id}`}
              style={[
                styles.connector,
                connectorSegment(index),
                { backgroundColor: withOpacity(contentColor, 0.25) },
              ]}
            />
          ))}
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
  // available once a task is done or won't-do, matching the buttons above.
  if (isComplete) return card;

  return (
    <>
      <MoreMenu
        task={task}
        onChangePriority={(priority) => onUpdate({ priority })}
        onChangeSchedule={handleChangeSchedule}
        onChangeList={(listId) => onUpdate({ listId })}
        onSetAlarm={() => setAlarmModalVisible(true)}
        onClearAlarm={() => onUpdate({ alarmTime: null })}
        onAddSubtask={addSubtask}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        style={styles.moreMenuWrapper}
      >
        {card}
      </MoreMenu>
      <SetAlarmModal
        visible={alarmModalVisible}
        initialTime={task.alarmTime}
        // The alarm fires on the task's scheduled day; an unscheduled task is
        // pulled to today (see handleConfirmAlarm), so bound the picker to now
        // only when that day is today — a future day makes any time valid.
        minTime={
          (task.scheduledFor ?? Temporal.Now.plainDateISO().toString()) ===
          Temporal.Now.plainDateISO().toString()
            ? currentAlarmTime()
            : undefined
        }
        onCancel={() => setAlarmModalVisible(false)}
        onConfirm={handleConfirmAlarm}
      />
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
    // Floor of padding (16×2) + button height (32). A completed card's only
    // height-defining child is the StatusButton's native menu host, whose
    // async sizing can transiently report 0 — without this floor the row
    // (or a whole list of completed tasks) collapses blank. A floor, not a
    // fixed height, so multi-line titles and subtasks can still grow the card.
    minHeight: 64,
    overflow: "hidden",
    padding: 16,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  // No `flex: 1` — EditableText's wrapper owns that; see its stylesheet.
  title: {
    fontSize: 14,
    fontWeight: "500",
  },
  subtasks: {
    gap: SUBTASK_GAP,
    // Not indented: the checklist runs the full width of the title row, so a
    // subtask's controls sit directly under the parent's, both columns of
    // circles on the same vertical axes.
    paddingHorizontal: SUBTASK_INSET,
    paddingTop: SUBTASK_OFFSET,
  },
  connector: {
    // Down the axis the circles share. The negative margin re-centers the line
    // on that axis rather than hanging it off the right of it.
    left: SUBTASK_INSET + SUBTASK_STATUS_SIZE / 2,
    marginLeft: -CONNECTOR_WIDTH / 2,
    position: "absolute",
    width: CONNECTOR_WIDTH,
  },
});
