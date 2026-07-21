import { Temporal } from "@js-temporal/polyfill";
import type { ReactNode } from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { DraxView } from "react-native-drax";

import { TTask } from "@/api/tasks";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useScheduleChange } from "@/hooks/useScheduleChange";
import { useTasks } from "@/hooks/useTasks";
import { useTheme } from "@/utils/theme";

type TTasksDropTargetProps = {
  /** The day a dropped task is scheduled for. */
  date: Temporal.PlainDate;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Wraps the Tasks pane as the drop target for tasks dragged out of the backlog
 * (DEX-77). Kept separate from both neighbours on purpose: `TasksView` is
 * shared with small screens, where there's no `DraxProvider` ancestor for a
 * `DraxView` to register with, and `LargeScreenToday` is pane composition that
 * shouldn't also own a task subscription and a modal. Isolating them here also
 * keeps the `useTasks()` subscription in a leaf — every write to the canonical
 * `["tasks"]` cache (including the new optimistic ones) re-renders this
 * wrapper, but `children` is built by the parent and bails out.
 *
 * Must be rendered inside a `DraxProvider`.
 */
export function TasksDropTarget({
  date,
  style,
  children,
}: TTasksDropTargetProps) {
  const theme = useTheme();
  const [, { updateTask }] = useTasks();
  // Shares the card's alarm-confirmation flow, so a dropped task carrying an
  // alarm prompts exactly like rescheduling from its own menu.
  const { changeSchedule, confirmationProps } = useScheduleChange(updateTask);

  return (
    <DraxView
      testID="tasks-drop-target"
      style={style}
      draggable={false}
      receivingStyle={[
        styles.receiving,
        { borderColor: theme.colors.text, borderRadius: theme.borderRadius },
      ]}
      onReceiveDragDrop={({ dragged }) => {
        // `payload` is `unknown` at the drax boundary; the drawer sets it to
        // the whole task (see TaskDrawer's `enableDrag` branch).
        const task = dragged.payload as TTask | undefined;
        if (task) void changeSchedule(task, date.toString());
      }}
    >
      {children}
      <ConfirmationModal {...confirmationProps} />
    </DraxView>
  );
}

const styles = StyleSheet.create({
  // Applied only while a dragged card is over the pane — an outline, not a
  // fill, so the day's cards stay legible underneath and the drop target reads
  // without the pane's contents shifting.
  receiving: {
    borderWidth: 2,
  },
});
