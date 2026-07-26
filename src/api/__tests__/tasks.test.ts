import { SupabaseClient } from "@supabase/supabase-js";

import {
  appendSubtask,
  deleteTask,
  duplicateTaskInput,
  ETaskPriority,
  ETaskStatus,
  getTasks,
  promoteSubtaskInput,
  removeSubtask,
  TTask,
} from "@/api/tasks";
import { Database } from "@/types/database.types";

type QueryMock = Promise<{ data: unknown[]; error: null }> & {
  order: jest.Mock<QueryMock, [string]>;
};

describe("getTasks", () => {
  it("orders each task column separately", async () => {
    const state: { query?: QueryMock } = {};
    const order = jest.fn((_column: string): QueryMock => {
      if (!state.query) throw new Error("Query mock not initialized");
      return state.query;
    });
    const query: QueryMock = Object.assign(
      Promise.resolve({ data: [], error: null }),
      { order },
    );

    state.query = query;
    const select = jest.fn((): QueryMock => query);
    const from = jest.fn(() => ({ select }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await getTasks(supabase);

    expect(from).toHaveBeenCalledWith("tasks");
    expect(select).toHaveBeenCalledWith("*");
    expect(query.order).toHaveBeenNthCalledWith(1, "status");
    expect(query.order).toHaveBeenNthCalledWith(2, "priority");
    expect(query.order).toHaveBeenNthCalledWith(3, "due_on");
  });
});

const source: TTask = {
  id: "task-1",
  alarmTime: "17:30",
  title: "Write the report",
  dueOn: "2026-07-05",
  goalId: "goal-1",
  listId: "list-1",
  priority: ETaskPriority.URGENT,
  scheduledFor: "2026-07-03",
  status: ETaskStatus.IN_PROGRESS,
  subtasks: [
    { id: "sub-1", title: "Draft outline", status: ETaskStatus.DONE },
    { id: "sub-2", title: "Gather figures", status: ETaskStatus.TODO },
  ],
  templateId: "template-1",
};

describe("duplicateTaskInput", () => {
  it("copies every copyable field, keeping status, without an id or template", () => {
    expect(duplicateTaskInput(source)).toEqual({
      title: "Write the report",
      alarmTime: "17:30",
      dueOn: "2026-07-05",
      goalId: "goal-1",
      listId: "list-1",
      priority: ETaskPriority.URGENT,
      scheduledFor: "2026-07-03",
      status: ETaskStatus.IN_PROGRESS,
      subtasks: [
        expect.objectContaining({
          title: "Draft outline",
          status: ETaskStatus.DONE,
        }),
        expect.objectContaining({
          title: "Gather figures",
          status: ETaskStatus.TODO,
        }),
      ],
    });
    expect(duplicateTaskInput(source)).not.toHaveProperty("id");
    // A duplicate is an independent one-off: only the original drives the repeat.
    expect(duplicateTaskInput(source)).not.toHaveProperty("templateId");
  });

  it("re-keys the copied subtasks so the two checklists can diverge", () => {
    const copiedIds = duplicateTaskInput(source).subtasks?.map(({ id }) => id);

    expect(copiedIds).toHaveLength(2);
    expect(copiedIds).not.toContain("sub-1");
    expect(copiedIds).not.toContain("sub-2");
  });

  it("copies an empty checklist as an empty array", () => {
    expect(duplicateTaskInput({ ...source, subtasks: [] }).subtasks).toEqual(
      [],
    );
  });
});

describe("promoteSubtaskInput", () => {
  const subtask = source.subtasks[1];

  it("inherits the parent's context and the subtask's own title and status", () => {
    expect(promoteSubtaskInput(source, subtask)).toEqual({
      title: "Gather figures",
      status: ETaskStatus.TODO,
      alarmTime: null,
      dueOn: "2026-07-05",
      goalId: "goal-1",
      listId: "list-1",
      priority: ETaskPriority.URGENT,
      scheduledFor: "2026-07-03",
    });
  });

  it("never inherits the parent's alarm", () => {
    // An alarm is a deliberate per-task commitment; cloning it onto a promoted
    // checklist item would ring an alarm the user never set.
    expect(promoteSubtaskInput(source, subtask).alarmTime).toBeNull();
  });

  it("carries a completed subtask's status across, rather than resetting it", () => {
    const done = promoteSubtaskInput(source, source.subtasks[0]);

    expect(done.status).toBe(ETaskStatus.DONE);
  });
});

describe("removeSubtask", () => {
  it("drops only the matching subtask, preserving order", () => {
    expect(removeSubtask(source.subtasks, "sub-1")).toEqual([
      { id: "sub-2", title: "Gather figures", status: ETaskStatus.TODO },
    ]);
  });

  it("is a no-op for an id that is not present", () => {
    expect(removeSubtask(source.subtasks, "missing")).toHaveLength(2);
  });
});

describe("appendSubtask", () => {
  it("appends an empty open subtask ready for inline entry", () => {
    const appended = appendSubtask(source.subtasks);

    expect(appended).toHaveLength(3);
    expect(appended[2]).toEqual(
      expect.objectContaining({ title: "", status: ETaskStatus.TODO }),
    );
    expect(appended[2].id).toBeTruthy();
  });

  it("does not mutate the source array", () => {
    appendSubtask(source.subtasks);

    expect(source.subtasks).toHaveLength(2);
  });
});

describe("deleteTask", () => {
  it("deletes the row matching the given id", async () => {
    const eq = jest.fn(() => Promise.resolve({ error: null }));
    const del = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ delete: del }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await deleteTask(supabase, "task-1");

    expect(from).toHaveBeenCalledWith("tasks");
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("id", "task-1");
  });

  it("throws when Supabase returns an error", async () => {
    const error = new Error("delete failed");
    const eq = jest.fn(() => Promise.resolve({ error }));
    const del = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ delete: del }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await expect(deleteTask(supabase, "task-1")).rejects.toBe(error);
  });
});
