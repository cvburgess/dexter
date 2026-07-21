import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { ETaskStatus, TTask, TUpdateTask } from "@/api/tasks";
import { useScheduleChange } from "@/hooks/useScheduleChange";
import { currentAlarmTime, requestAlarmAuthorization } from "@/utils/alarms";
import { useTheme, withOpacity } from "@/utils/theme";

import { ConfirmationModal } from "./ConfirmationModal";
import { DueDateButton } from "./DueDateButton";
import { ListButton } from "./ListButton";
import { MoreMenu } from "./MoreMenu";
import { SetAlarmModal } from "./SetAlarmModal";
import { StatusButton } from "./StatusButton";

// Matches dexter-app's cardColors: incomplete cards sit on the priority color
// at 80% opacity; complete cards fade the same color to a 3% tint with muted
// (25% opacity) text, regardless of priority.
const INCOMPLETE_OPACITY = 0.8;
const COMPLETE_OPACITY = 0.03;
const COMPLETE_TEXT_OPACITY = 0.25;

type TTaskCardProps = {
  task: TTask;
  onUpdate: (diff: Omit<TUpdateTask, "id">) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function TaskCard({
  task,
  onUpdate,
  onDuplicate,
  onDelete,
}: TTaskCardProps) {
  const theme = useTheme();
  const [alarmModalVisible, setAlarmModalVisible] = useState(false);
  // The alarm-confirmation flow lives in the hook so every surface that
  // reschedules — this card, the backlog's "+", the drag-to-schedule drop
  // target — prompts identically (DEX-77). The id is dropped here because
  // this card's `onUpdate` is already bound to its own task by the parent.
  const { changeSchedule, confirmationProps } = useScheduleChange(
    ({ id: _id, ...diff }) => onUpdate(diff),
  );
  const isComplete =
    task.status === ETaskStatus.DONE || task.status === ETaskStatus.WONT_DO;

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
      <StatusButton
        status={task.status}
        contentColor={contentColor}
        onChangeStatus={(status) => onUpdate({ status })}
      />
      <Text
        numberOfLines={1}
        style={[
          styles.title,
          {
            color: contentColor,
            textDecorationLine: isComplete ? "line-through" : "none",
          },
        ]}
      >
        {task.title}
      </Text>
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
  );

  // Priority/schedule/list editing (and the long-press that opens it) isn't
  // available once a task is done or won't-do, matching the buttons above.
  if (isComplete) return card;

  return (
    <>
      <MoreMenu
        task={task}
        onChangePriority={(priority) => onUpdate({ priority })}
        onChangeSchedule={(scheduledFor) => changeSchedule(task, scheduledFor)}
        onChangeList={(listId) => onUpdate({ listId })}
        onSetAlarm={() => setAlarmModalVisible(true)}
        onClearAlarm={() => onUpdate({ alarmTime: null })}
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
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    // Floor of padding (16×2) + button height (32). A completed card's only
    // height-defining child is the StatusButton's native menu host, whose
    // async sizing can transiently report 0 — without this floor the row
    // (or a whole list of completed tasks) collapses blank. A floor, not a
    // fixed height, so multi-line titles can still grow the card.
    minHeight: 64,
    overflow: "hidden",
    padding: 16,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
});
