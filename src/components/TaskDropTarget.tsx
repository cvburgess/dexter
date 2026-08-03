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
  const receivingStyle = useMemo(
    () => ({ borderColor: theme.colors.primary }),
    [theme.colors.primary],
  );

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
  //
  // Written from an effect rather than during render (`react-hooks/refs`), which
  // costs nothing here: drax only calls these handlers during a drag, long after
  // the commit that refreshed them.
  const scheduledForRef = useRef(scheduledFor);
  const dragRef = useRef(drag);
  useEffect(() => {
    scheduledForRef.current = scheduledFor;
    dragRef.current = drag;
  });

  // Empty dependency arrays, and they have to stay that way — that is the whole
  // point of the refs above.
  //
  // Drax consults `acceptsDrag` before a view becomes the receiver, so a task
  // dragged back onto the day it already sits on never highlights and never
  // fires a drop — the affordance is right, not merely the write suppressed.
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

/**
 * The live task a drag payload refers to — as it is now, not as it was when the
 * card registered with drax. Undefined for a foreign payload, outside a
 * provider, or for a task deleted mid-drag.
 *
 * At module scope rather than a `useCallback` so the two handlers above can hold
 * genuinely empty dependency arrays.
 */
function resolveTask(payload: unknown, drag: TDragSchedule | null) {
  if (!isTaskDragPayload(payload)) return undefined;
  return drag?.getTask(payload.taskId);
}

const styles = StyleSheet.create({
  // A reserved, transparent border: the width is always paid, so tinting it on
  // hover costs no layout. Introducing the width on hover instead would shrink
  // the content box and reflow every card in the region for as long as a finger
  // hovers over it.
  //
  // It sits *before* the caller's `style` so a pane that already draws a border
  // (the backlog pane's hairline) keeps its own width and color — overriding
  // those would have erased that pane's edge. Either way a border exists to
  // tint, so there is no reflow in either arrangement; `receivingStyle` is
  // applied over both.
  target: {
    borderColor: "transparent",
    borderWidth: 2,
  },
});
