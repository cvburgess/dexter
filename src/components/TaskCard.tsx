import { StyleSheet, Text, View } from "react-native";

import { ETaskStatus, TTask, TUpdateTask } from "@/api/tasks";
import { useTheme, withOpacity } from "@/utils/theme";

import { DueDateButton } from "./DueDateButton";
import { ListButton } from "./ListButton";
import { MoreButton } from "./MoreButton";
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
};

export function TaskCard({ task, onUpdate }: TTaskCardProps) {
  const theme = useTheme();
  const isComplete =
    task.status === ETaskStatus.DONE || task.status === ETaskStatus.WONT_DO;
  const priorityColor = theme.colors.priority[task.priority];
  // The color everything on the card (title, button outlines/icons, border)
  // is drawn in — matches dexter-app's Card.tsx, which derives all of it
  // from the priority's "-content" color, muted to `text` when done.
  const contentColor = isComplete
    ? withOpacity(theme.colors.text, COMPLETE_TEXT_OPACITY)
    : theme.colors.priorityContent[task.priority];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: withOpacity(
            priorityColor,
            isComplete ? COMPLETE_OPACITY : INCOMPLETE_OPACITY,
          ),
          borderColor: withOpacity(contentColor, 0.1),
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
          <DueDateButton dueOn={task.dueOn} contentColor={contentColor} />
          <ListButton
            listId={task.listId}
            contentColor={contentColor}
            onChangeList={(listId) => onUpdate({ listId })}
          />
          <MoreButton
            priority={task.priority}
            scheduledFor={task.scheduledFor}
            contentColor={contentColor}
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
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    overflow: "hidden",
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
});
