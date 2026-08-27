/** What a dragged task card carries. See {@link isTaskDragPayload}. */
export type TTaskDragPayload = { taskId: string };

// Narrows an untyped drax payload (DEX-77). The payload is an id, not the
// task — drax snapshots props at registration, so a task payload would freeze.
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
