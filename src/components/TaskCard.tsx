import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { ETaskStatus, TTask, TUpdateTask } from "@/api/tasks";
import { useConfirmation } from "@/hooks/useConfirmation";
import { requestAlarmAuthorization } from "@/utils/alarms";
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
  const { confirm, confirmationProps } = useConfirmation();
  const isComplete =
    task.status === ETaskStatus.DONE || task.status === ETaskStatus.WONT_DO;

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
        onChangeSchedule={handleChangeSchedule}
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
