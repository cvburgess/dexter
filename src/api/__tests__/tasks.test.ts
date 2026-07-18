import { SupabaseClient } from "@supabase/supabase-js";

import {
  deleteTask,
  duplicateTaskInput,
  ETaskPriority,
  ETaskStatus,
  getTasks,
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

describe("duplicateTaskInput", () => {
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
    templateId: "template-1",
  };

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
    });
    expect(duplicateTaskInput(source)).not.toHaveProperty("id");
    // A duplicate is an independent one-off: only the original drives the repeat.
    expect(duplicateTaskInput(source)).not.toHaveProperty("templateId");
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
