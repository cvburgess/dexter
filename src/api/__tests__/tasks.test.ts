import { SupabaseClient } from "@supabase/supabase-js";

import {
  appendSubtask,
  deleteTask,
  duplicateTaskInput,
  ETaskPriority,
  ETaskStatus,
  hasOpenTaskForTemplate,
  promoteSubtaskInput,
  removeSubtask,
  TTask,
} from "@/api/tasks";
import { Database } from "@/types/database.types";

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
  url: "https://example.com/report",
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
      url: "https://example.com/report",
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
      url: "https://example.com/report",
    });
  });

  // A link is context like the list and the deadline, not a commitment like the
  // alarm below — it has no side effect to clone.
  it("inherits the parent's link", () => {
    expect(promoteSubtaskInput(source, subtask).url).toBe(
      "https://example.com/report",
    );
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

// The one predicate behind "can this repeat still fire?". Recurrence spawns
// from *completing* a linked task, so a template whose links are all closed out
// is stalled — which is why the status filter is load-bearing rather than a
// tidy-up: `template_id` also records provenance for tasks stamped from a
// template, and those get checked off like any other.
describe("hasOpenTaskForTemplate", () => {
  const mockQuery = (result: { data: unknown[]; error: unknown }) => {
    const limit = jest.fn(() => Promise.resolve(result));
    const isIn = jest.fn(() => ({ limit }));
    const eq = jest.fn(() => ({ in: isIn }));
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select }));
    const supabase = { from } as unknown as SupabaseClient<Database>;
    return { supabase, from, select, eq, isIn, limit };
  };

  it("asks only for open tasks linked to the template", async () => {
    const { supabase, from, select, eq, isIn, limit } = mockQuery({
      data: [{ id: "task-1" }],
      error: null,
    });

    await expect(hasOpenTaskForTemplate(supabase, "template-1")).resolves.toBe(
      true,
    );

    expect(from).toHaveBeenCalledWith("tasks");
    expect(select).toHaveBeenCalledWith("id");
    expect(eq).toHaveBeenCalledWith("template_id", "template-1");
    expect(isIn).toHaveBeenCalledWith("status", [
      ETaskStatus.TODO,
      ETaskStatus.IN_PROGRESS,
    ]);
    // Existence, not a count — one row is enough.
    expect(limit).toHaveBeenCalledWith(1);
  });

  // No date filter: an occurrence scheduled a year out still counts, and so
  // does one from long before the canonical query's recent window.
  it("is false when every linked task has been closed out", async () => {
    const { supabase } = mockQuery({ data: [], error: null });

    await expect(hasOpenTaskForTemplate(supabase, "template-1")).resolves.toBe(
      false,
    );
  });

  it("throws when Supabase returns an error", async () => {
    const error = new Error("select failed");
    const { supabase } = mockQuery({ data: [], error });

    await expect(hasOpenTaskForTemplate(supabase, "template-1")).rejects.toBe(
      error,
    );
  });
});

describe("deleteTask", () => {
  it("throws when Supabase returns an error", async () => {
    const error = new Error("delete failed");
    const eq = jest.fn(() => Promise.resolve({ error }));
    const del = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ delete: del }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await expect(deleteTask(supabase, "task-1")).rejects.toBe(error);
  });
});
