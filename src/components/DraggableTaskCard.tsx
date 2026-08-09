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

/**
 * A `TaskCard` that can be dragged onto a `TaskDropTarget` to reschedule it
 * (DEX-77).
 *
 * Outside a `DragScheduleProvider` it is exactly a `TaskCard` — which is what
 * keeps the small-screen layouts, the backlog sheet, and the Search tab on the
 * existing path without an `enableDrag` prop threaded through every host, and
 * what stops a `DraxView` mounting where drax's provider doesn't exist (it
 * throws). See `useDragSchedule`.
 *
 * Hosts must key this per task. `DayTaskList` and `TaskDrawer` both do, and
 * `TaskDrawer`'s reason is the sharper one: `FlashList` recycles a row's
 * component instance for a different task rather than remounting it, and drax
 * caches a view's props when it registers.
 */
export function DraggableTaskCard(props: TDraggableTaskCardProps) {
  const drag = useDragSchedule();
  // Local, not lifted: only this wrapper needs it, and `TaskCard` already owns
  // the state this mirrors.
  const [editing, setEditing] = useState(false);

  // The preview is rendered from drax's cached copy of this prop, which it
  // refreshes only when a capability prop changes — so an inline arrow would
  // keep painting the task as it was when the card registered. Editing a task's
  // priority from its own menu doesn't remount the card, and the preview would
  // have travelled in the old priority's color.
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
      // A finished task isn't draggable, matching the card itself: `TaskCard`
      // withholds `MoreMenu` — and with it the whole Schedule submenu — once a
      // task reaches a terminal status, so a drag would otherwise be the only
      // way left to reschedule one.
      //
      // Suspending it while a field is focused is a separate matter, and it
      // applies on every platform: the drag activates on sideways travel with
      // no hold at all (see `dragActivation`), which is exactly the gesture for
      // dragging across a title to select its text. Same fix, and the same
      // reason, as `SwipeablePage`'s `enabled={!editing}`.
      draggable={!editing && !isCompletionStatus(task.status)}
      // A card is a drop target's guest, never a target itself; without this
      // drax would let one card receive another.
      receptive={false}
      payload={payload}
      longPressDelay={DRAG_ACTIVATION.longPressDelay}
      dragActivationOffsetX={DRAG_ACTIVATION.dragActivationOffsetX}
      dragActivationFailOffsetY={DRAG_ACTIVATION.dragActivationFailOffsetY}
      draggingStyle={styles.dragging}
      // Drax's default hover would re-render this card's own children into the
      // overlay, mounting a second set of native menu hosts that paint nothing.
      // See `TaskCardPreview`.
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
