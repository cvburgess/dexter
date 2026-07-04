import { StyleSheet, Text, View } from "react-native";

import { ETaskStatus, TTask, TUpdateTask } from "@/api/tasks";
import { useTheme } from "@/utils/theme";

import { DueDateButton } from "./DueDateButton";
import { ListButton } from "./ListButton";
import { MoreButton } from "./MoreButton";
import { StatusButton } from "./StatusButton";

type TTaskCardProps = {
  task: TTask;
  onUpdate: (diff: Omit<TUpdateTask, "id">) => void;
};

export function TaskCard({ task, onUpdate }: TTaskCardProps) {
  const theme = useTheme();
  const isComplete =
    task.status === ETaskStatus.DONE || task.status === ETaskStatus.WONT_DO;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.card }]}
      testID={`task-card-${task.id}`}
    >
      <View
        testID="task-card-accent"
        style={[
          styles.accent,
          {
            backgroundColor: theme.colors.priority[task.priority],
            opacity: isComplete ? 0.3 : 1,
          },
        ]}
      />
      <StatusButton
        status={task.status}
        onChangeStatus={(status) => onUpdate({ status })}
      />
      <Text
        numberOfLines={1}
        style={[
          styles.title,
          {
            color: isComplete ? theme.colors.textSecondary : theme.colors.text,
            textDecorationLine: isComplete ? "line-through" : "none",
          },
        ]}
      >
        {task.title}
      </Text>
      {!isComplete && (
        <>
          <DueDateButton dueOn={task.dueOn} />
          <ListButton
            listId={task.listId}
            onChangeList={(listId) => onUpdate({ listId })}
          />
          <MoreButton
            priority={task.priority}
            scheduledFor={task.scheduledFor}
            onChangePriority={(priority) => onUpdate({ priority })}
            onChangeSchedule={(scheduledFor) => onUpdate({ scheduledFor })}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    overflow: "hidden",
    padding: 8,
  },
  accent: {
    alignSelf: "stretch",
    borderRadius: 2,
    width: 4,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
});
