import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import { DraxView } from "react-native-drax";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { setNativeProps } from "react-native-reanimated";

import { useDragSchedule } from "@/components/DragScheduleProvider";
import { TaskCard } from "@/components/TaskCard";
import { TaskCardPreview } from "@/components/TaskCardPreview";
import { dragActivation } from "@/utils/dragActivation";
import { TTaskDragPayload } from "@/utils/dragPayload";
import { isCompletionStatus } from "@/utils/taskFilters";

// `onEditingChange` is claimed by this wrapper to gate the drag, so it isn't
// offered to callers — passing one would be silently ignored.
type TDraggableTaskCardProps = Omit<
  ComponentProps<typeof TaskCard>,
  "onEditingChange"
>;

// Resolved once: the values are constant, and re-deriving them per card would
// put a fresh object on every DraxView on a dense week screen.
const DRAG_ACTIVATION = dragActivation();

/** A `TaskCard` draggable onto a `TaskDropTarget` (DEX-77) — a plain
 * `TaskCard` outside a `DragScheduleProvider`. Hosts must key this per task. */
export function DraggableTaskCard(props: TDraggableTaskCardProps) {
  const { task } = props;
  const drag = useDragSchedule();
  // Local, not lifted: only this wrapper needs it, and `TaskCard` already owns
  // the state this mirrors.
  const [editing, setEditing] = useState(false);
  // Not draggable when finished, or mid-edit — no-hold activation is the same
  // gesture as selecting title text (SwipeablePage's `!editing`).
  const draggable =
    !!drag?.enabled && !editing && !isCompletionStatus(task.status);

  // Read through a ref: drax caches this prop and only refreshes it on a
  // capability-prop change, so an inline arrow would freeze the old priority.
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  });
  const renderHoverContent = useCallback(
    ({ dimensions }: { dimensions?: { width: number } }) => (
      <TaskCardPreview task={taskRef.current} width={dimensions?.width} />
    ),
    [],
  );

  // Nothing arbitrates a native scroll against drax's pan, so a fast sideways
  // move let the scroller win (DEX-207); pause it from touch-down, on the UI thread.
  const pauseScrollRef = drag?.pauseScrollRef;
  const pressGesture = useMemo(() => {
    if (!pauseScrollRef) return null;
    const resume = () => {
      "worklet";
      setNativeProps(pauseScrollRef, { scrollEnabled: true });
    };
    return Gesture.Manual()
      .enabled(draggable)
      .withTestId(`task-press-${task.id}`)
      .onBegin(() => {
        setNativeProps(pauseScrollRef, { scrollEnabled: false });
      })
      .onTouchesUp(resume)
      .onTouchesCancelled(resume)
      .onFinalize(resume);
  }, [pauseScrollRef, draggable, task.id]);

  if (!drag) return <TaskCard {...props} />;

  const payload: TTaskDragPayload = { taskId: task.id };
  const card = <TaskCard {...props} onEditingChange={setEditing} />;

  return (
    <DraxView
      testID={`task-drag-${task.id}`}
      draggable={draggable}
      // A card is a drop target's guest, never a target itself; without this
      // drax would let one card receive another.
      receptive={false}
      payload={payload}
      longPressDelay={DRAG_ACTIVATION.longPressDelay}
      dragActivationOffsetX={DRAG_ACTIVATION.dragActivationOffsetX}
      dragActivationFailOffsetY={DRAG_ACTIVATION.dragActivationFailOffsetY}
      draggingStyle={styles.dragging}
      // Default hover would re-render this card's children into the overlay,
      // mounting a second set of native menu hosts (TaskCardPreview).
      renderHoverContent={renderHoverContent}
    >
      {pressGesture ? (
        <GestureDetector gesture={pressGesture}>
          <View>{card}</View>
        </GestureDetector>
      ) : (
        card
      )}
    </DraxView>
  );
}

const styles = StyleSheet.create({
  // The card left behind fades while its preview travels, so the row it came
  // from still holds its place in the list rather than collapsing.
  dragging: {
    opacity: 0.2,
  },
});
