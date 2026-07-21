import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";

import { sortTasks } from "../sortTasks";

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: null,
  status: ETaskStatus.TODO,
  templateId: null,
  title: "Write report",
  ...overrides,
});

const ids = (tasks: TTask[]) => tasks.map(({ id }) => id);

describe("sortTasks", () => {
  it("orders by status first", () => {
    const sorted = sortTasks([
      task({ id: "done", status: ETaskStatus.DONE }),
      task({ id: "in-progress", status: ETaskStatus.IN_PROGRESS }),
      task({ id: "todo", status: ETaskStatus.TODO }),
    ]);

    expect(ids(sorted)).toEqual(["in-progress", "todo", "done"]);
  });

  it("orders by priority within a status", () => {
    const sorted = sortTasks([
      task({ id: "none", priority: ETaskPriority.UNPRIORITIZED }),
      task({ id: "urgent", priority: ETaskPriority.URGENT }),
      task({ id: "both", priority: ETaskPriority.IMPORTANT_AND_URGENT }),
    ]);

    expect(ids(sorted)).toEqual(["both", "urgent", "none"]);
  });

  it("orders by due date within a priority, undated last", () => {
    const sorted = sortTasks([
      task({ id: "undated", dueOn: null }),
      task({ id: "later", dueOn: "2026-08-01" }),
      task({ id: "sooner", dueOn: "2026-07-21" }),
    ]);

    expect(ids(sorted)).toEqual(["sooner", "later", "undated"]);
  });

  it("does not mutate its input", () => {
    const input = [
      task({ id: "b", priority: ETaskPriority.NEITHER }),
      task({ id: "a", priority: ETaskPriority.URGENT }),
    ];

    sortTasks(input);

    expect(ids(input)).toEqual(["b", "a"]);
  });
});
