import { isTaskDragPayload } from "../dragPayload";

describe("isTaskDragPayload", () => {
  it("accepts a payload carrying a task id", () => {
    expect(isTaskDragPayload({ taskId: "task-1" })).toBe(true);
  });

  // Drax types every payload as `unknown`, so a receiver has no guarantee about
  // what reaches it. Anything that slipped through would reach `updateTask` with
  // an undefined id and write a row that doesn't exist.
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "task-1"],
    ["an empty object", {}],
    ["a non-string id", { taskId: 7 }],
    [
      "a whole task, which this deliberately no longer carries",
      {
        id: "task-1",
        scheduledFor: null,
      },
    ],
  ])("rejects %s", (_label, payload) => {
    expect(isTaskDragPayload(payload)).toBe(false);
  });
});
