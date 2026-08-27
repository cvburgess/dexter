import {
  ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { StyleSheet } from "react-native";
import { DraxView } from "react-native-drax";

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
  const drag = useDragSchedule();
  // Local, not lifted: only this wrapper needs it, and `TaskCard` already owns
  // the state this mirrors.
  const [editing, setEditing] = useState(false);

  // Read through a ref: drax caches this prop and only refreshes it on a
  // capability-prop change, so an inline arrow would freeze the old priority.
  const taskRef = useRef(props.task);
  useEffect(() => {
    taskRef.current = props.task;
  });
  const renderHoverContent = useCallback(
    ({ dimensions }: { dimensions?: { width: number } }) => (
      <TaskCardPreview task={taskRef.current} width={dimensions?.width} />
    ),
    [],
  );

  if (!drag) return <TaskCard {...props} />;

  const { task } = props;
  const payload: TTaskDragPayload = { taskId: task.id };

  return (
    <DraxView
      testID={`task-drag-${task.id}`}
      // Not draggable when finished, or mid-edit — no-hold activation is
      // the same gesture as selecting title text (SwipeablePage's `!editing`).
      draggable={!editing && !isCompletionStatus(task.status)}
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
      <TaskCard {...props} onEditingChange={setEditing} />
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
