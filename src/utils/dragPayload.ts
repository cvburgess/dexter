/** What a dragged task card carries. See {@link isTaskDragPayload}. */
export type TTaskDragPayload = { taskId: string };

/**
 * Narrows a drag payload to a dragged task card (DEX-77).
 *
 * `react-native-drax` types every payload as `unknown` — it has no idea what an
 * app puts in one — so each receiver has to prove what it got before using it.
 * `DraggableTaskCard` is the only source in the app today, but a truthiness
 * check alone would let a future one through and reach `updateTask` with an
 * undefined id, writing a row that doesn't exist.
 *
 * The payload is an **id, not the task**. Drax snapshots a view's props into
 * its registry at registration and refreshes that snapshot only when a
 * capability prop changes, so a whole-task payload freezes: a card that stays
 * mounted while the user sets an alarm on it from its own menu would still be
 * dragging the alarm-less version, and skip the prompt that alarm exists to
 * trigger. An id is the one field that cannot go stale for a given card, and
 * the receiver resolves the live task through `useDragSchedule`.
 */
export function isTaskDragPayload(
  payload: unknown,
): payload is TTaskDragPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "taskId" in payload &&
    typeof (payload as TTaskDragPayload).taskId === "string"
  );
}
