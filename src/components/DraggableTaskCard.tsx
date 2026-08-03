import { ComponentProps, useState } from "react";
import { StyleSheet } from "react-native";
import { DraxView } from "react-native-drax";

import { useDragSchedule } from "@/components/DragScheduleProvider";
import { TaskCard } from "@/components/TaskCard";
import { TaskCardPreview } from "@/components/TaskCardPreview";
import { dragActivation } from "@/utils/dragActivation";
import { TTaskDragPayload } from "@/utils/dragPayload";

// `onEditingChange` is claimed by this wrapper to gate the drag, so it isn't
// offered to callers — passing one would be silently ignored.
type TDraggableTaskCardProps = Omit<
  ComponentProps<typeof TaskCard>,
  "onEditingChange"
>;

// Resolved once: `Platform.OS` can't change at runtime, and re-deriving it per
// card would put a fresh object on every DraxView on a dense week screen.
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
 */
export function DraggableTaskCard(props: TDraggableTaskCardProps) {
  const drag = useDragSchedule();
  // Local, not lifted: only this wrapper needs it, and `TaskCard` already owns
  // the state this mirrors.
  const [editing, setEditing] = useState(false);

  if (!drag) return <TaskCard {...props} />;

  const { task } = props;
  const payload: TTaskDragPayload = { taskId: task.id };

  return (
    <DraxView
      // Keyed on the task so a recycled row re-registers with drax. `TaskDrawer`
      // renders these inside a `FlashList`, which reuses a cell's component
      // instance for a different task without remounting — and drax caches a
      // view's props at registration, so without this the cell would keep
      // dragging whichever task happened to mount in it first.
      key={task.id}
      testID={`task-drag-${task.id}`}
      draggable={!editing}
      // A card is a drop target's guest, never a target itself; without this
      // drax would let one card receive another.
      receptive={false}
      payload={payload}
      longPressDelay={DRAG_ACTIVATION.longPressDelay}
      dragActivationFailOffset={DRAG_ACTIVATION.dragActivationFailOffset}
      draggingStyle={styles.dragging}
      // Drax's default hover would re-render this card's own children into the
      // overlay, mounting a second set of native menu hosts that paint nothing.
      // See `TaskCardPreview`.
      renderHoverContent={({ dimensions }) => (
        <TaskCardPreview task={task} width={dimensions?.width} />
      )}
    >
      {/* Suspending the drag while a field is focused: on web there is no hold
          before the drag takes over (see `dragActivation`), so dragging across
          a title to select it would pick the card up instead. Same fix, and the
          same reason, as `SwipeableDay`'s `enabled={!editing}`. */}
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
