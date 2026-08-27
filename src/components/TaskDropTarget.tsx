import { ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { DraxView } from "react-native-drax";

import {
  TDragSchedule,
  useDragSchedule,
} from "@/components/DragScheduleProvider";
import { isTaskDragPayload } from "@/utils/dragPayload";
import { useTheme } from "@/utils/theme";

type TTaskDropTargetProps = {
  /** The ISO date a dropped task is scheduled for; `null` unschedules it,
   * making the backlog pane a target for dragging a task back out. */
  scheduledFor: string | null;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
};

// Reschedules a task dropped onto it (DEX-77). Outside a DragScheduleProvider
// it's a plain View, since a bare DraxView throws — see useDragSchedule.
export function TaskDropTarget({
  scheduledFor,
  style,
  children,
  testID,
}: TTaskDropTargetProps) {
  const theme = useTheme();
  const drag = useDragSchedule();
  const receivingStyle = useMemo(
    () => ({ borderColor: theme.colors.primary }),
    [theme.colors.primary],
  );

  // Drax dispatches off a props snapshot taken at registration, so a stable
  // closure reading through refs is the fix — see the test's rerender capture.
  const scheduledForRef = useRef(scheduledFor);
  const dragRef = useRef(drag);
  useEffect(() => {
    scheduledForRef.current = scheduledFor;
    dragRef.current = drag;
  });

  // Empty deps — the point of the refs above. Drax consults acceptsDrag
  // before highlighting, so a task dragged onto its own day never highlights.
  const acceptsDrag = useCallback((payload: unknown) => {
    const task = resolveTask(payload, dragRef.current);
    return task !== undefined && task.scheduledFor !== scheduledForRef.current;
  }, []);

  const onReceiveDragDrop = useCallback(
    ({ dragged }: { dragged: { payload?: unknown } }) => {
      const task = resolveTask(dragged.payload, dragRef.current);
      // Not redundant with `acceptsDrag`: the task can be deleted between the
      // two, from another device or another pane.
      if (!task) return;
      void dragRef.current?.scheduleTask(task, scheduledForRef.current);
    },
    [],
  );

  if (!drag) return <View style={style}>{children}</View>;

  return (
    <DraxView
      testID={testID}
      style={[styles.target, style]}
      // Explicit: drax treats any view carrying a payload *or* a drag handler as
      // draggable, and a receiver that is also a source can pick itself up.
      draggable={false}
      receptive
      acceptsDrag={acceptsDrag}
      onReceiveDragDrop={onReceiveDragDrop}
      // Color only — see `styles.target` for why the width is already reserved.
      receivingStyle={receivingStyle}
    >
      {children}
    </DraxView>
  );
}

// The live task a payload refers to, as it is now — undefined for a foreign
// payload or a deleted task. Module scope so both handlers keep empty deps.
function resolveTask(payload: unknown, drag: TDragSchedule | null) {
  if (!isTaskDragPayload(payload)) return undefined;
  return drag?.getTask(payload.taskId);
}

const styles = StyleSheet.create({
  // Reserved, transparent border: always paid, so tinting on hover costs no
  // layout. Before the caller's `style` so a pane's own hairline border wins.
  target: {
    borderColor: "transparent",
    borderWidth: 2,
  },
});
