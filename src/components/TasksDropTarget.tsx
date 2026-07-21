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
    <>
      <DraxView
        testID="tasks-drop-target"
        // The transparent border is carried in the base style so `receivingStyle`
        // only has to change its color. Introducing the border width on hover
        // instead would shrink the content box by 4px and reflow every card in
        // the pane for the duration of the drag.
        style={[styles.pane, { borderRadius: theme.borderRadius }, style]}
        draggable={false}
        receivingStyle={{ borderColor: theme.colors.text }}
        onReceiveDragDrop={({ dragged }) => {
          if (isTask(dragged.payload)) {
            void changeSchedule(dragged.payload, date.toString());
          }
        }}
      >
        {children}
      </DraxView>
      {/* A sibling, not a child: on web this renders a react-native-web
          `Modal` that lays out inline, and nesting it inside the bordered,
          animated drop target would anchor it to that pane instead of the
          screen. */}
      <ConfirmationModal {...confirmationProps} />
    </>
  );
}

/**
 * Narrows the drag payload, which drax types as `unknown`. `TaskDrawer`'s
 * `enableDrag` branch is the only source today, but a truthiness check alone
 * would let any future drag source through and reach `updateTask` with an
 * undefined id — so check the two fields the reschedule actually reads.
 */
function isTask(payload: unknown): payload is TTask {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "id" in payload &&
    typeof (payload as TTask).id === "string" &&
    "scheduledFor" in payload
  );
}

const styles = StyleSheet.create({
  // The border is always present and transparent; `receivingStyle` only tints
  // it while a card hovers, so the highlight costs no layout. An outline
  // rather than a fill keeps the day's cards legible underneath.
  pane: {
    borderColor: "transparent",
    borderWidth: 2,
  },
});
