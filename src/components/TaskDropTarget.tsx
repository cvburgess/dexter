import { ReactNode, useCallback, useRef } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { DraxView } from "react-native-drax";

import { useDragSchedule } from "@/components/DragScheduleProvider";
import { isTaskDragPayload } from "@/utils/dragPayload";
import { useTheme } from "@/utils/theme";

type TTaskDropTargetProps = {
  /**
   * The ISO date a task dropped here is scheduled for; `null` unschedules it,
   * which is what makes the backlog pane a target for dragging a task back out
   * of a day.
   */
  scheduledFor: string | null;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
};

/**
 * A region that reschedules a task dropped onto it (DEX-77) — one day column on
 * the Week tab, the Tasks pane on Today, or either layout's backlog pane.
 *
 * Outside a `DragScheduleProvider` this is a plain `View`, so the components it
 * wraps stay renderable on small screens and in isolation (a `DraxView` without
 * a provider throws). See `useDragSchedule`.
 */
export function TaskDropTarget({
  scheduledFor,
  style,
  children,
  testID,
}: TTaskDropTargetProps) {
  const theme = useTheme();
  const drag = useDragSchedule();

  // Drax snapshots a view's props into its registry when the view registers,
  // and refreshes that snapshot only when a *capability* prop changes
  // (`draggable`/`receptive`/`monitoring`/`collisionAlgorithm` — see
  // `DraxView`'s `updateViewProps` effect). Dispatch then reads the handlers
  // off that snapshot, not off the live element. So an inline arrow here would
  // be frozen at the value it closed over on mount: on Today, where this pane's
  // date follows the day nav, every drop would schedule onto whatever day was
  // showing when the pane first rendered.
  //
  // A `useCallback` keyed on the date does *not* fix it — a new identity is
  // exactly what the registry declines to pick up. The fix is the opposite: one
  // closure that never changes identity, reading what it needs through refs.
  // PR #73 had the inline form; its test passed only because the Jest stub is a
  // pass-through `View` that calls the current prop, which is also why the stub
  // can't guard this. `TaskDropTarget.test.tsx` invokes a *captured* handler
  // after a rerender instead, which reproduces what drax actually does.
  const scheduledForRef = useRef(scheduledFor);
  scheduledForRef.current = scheduledFor;
  const dragRef = useRef(drag);
  dragRef.current = drag;

  // Resolves the payload against the live cache, so a card that has been
  // rescheduled or had an alarm set since it registered is judged on what it is
  // now. Undefined for a foreign payload or a task deleted mid-drag.
  const resolve = useCallback((payload: unknown) => {
    if (!isTaskDragPayload(payload)) return undefined;
    return dragRef.current?.getTask(payload.taskId);
  }, []);

  // Drax consults `acceptsDrag` before a view becomes the receiver, so a task
  // dragged back onto the day it already sits on never highlights and never
  // fires a drop — the affordance is right, not merely the write suppressed.
  const acceptsDrag = useCallback(
    (payload: unknown) => {
      const task = resolve(payload);
      return (
        task !== undefined && task.scheduledFor !== scheduledForRef.current
      );
    },
    [resolve],
  );

  const onReceiveDragDrop = useCallback(
    ({ dragged }: { dragged: { payload?: unknown } }) => {
      const task = resolve(dragged.payload);
      if (!task) return;
      void dragRef.current?.scheduleTask(task, scheduledForRef.current);
    },
    [resolve],
  );

  if (!drag) return <View style={style}>{children}</View>;

  return (
    <DraxView
      testID={testID}
      style={[style, styles.target]}
      // Explicit: drax treats any view carrying a payload *or* a drag handler as
      // draggable, and a receiver that is also a source can pick itself up.
      draggable={false}
      receptive
      acceptsDrag={acceptsDrag}
      onReceiveDragDrop={onReceiveDragDrop}
      // Only the border *color* changes on hover. Introducing the width here
      // instead would shrink the content box by 4px mid-drag and reflow every
      // card in the region for as long as the finger hovers.
      receivingStyle={{ borderColor: theme.colors.primary }}
    >
      {children}
    </DraxView>
  );
}

const styles = StyleSheet.create({
  // The border is always present and transparent so hovering costs no layout.
  // It sits after the caller's `style` so a pane that brings its own border
  // (the backlog and calendar panes both do) can't override the reserved width
  // and bring that reflow back.
  target: {
    borderColor: "transparent",
    borderWidth: 2,
  },
});
