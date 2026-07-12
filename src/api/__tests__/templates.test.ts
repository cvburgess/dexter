import { SupabaseClient } from "@supabase/supabase-js";

import { ETaskPriority } from "@/api/tasks";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  updateTemplate,
} from "@/api/templates";
import { Database } from "@/types/database.types";

// A thenable query builder: awaiting it resolves rows, and `.order` returns the
// same builder so calls can chain (mirrors PostgREST's builder).
type ChainMock = Promise<{ data: unknown[]; error: null }> & {
  order: jest.Mock;
};

const makeChain = (data: unknown[] = []): ChainMock => {
  const chain = Promise.resolve({ data, error: null }) as ChainMock;
  chain.order = jest.fn(() => chain);
  return chain;
};

describe("getTemplates", () => {
  it("selects templates ordered by created_at", async () => {
    const chain = makeChain();
    const select = jest.fn(() => chain);
    const from = jest.fn(() => ({ select }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await getTemplates(supabase);

    expect(from).toHaveBeenCalledWith("repeat_task_templates");
    expect(select).toHaveBeenCalledWith("*");
    expect(chain.order).toHaveBeenCalledWith("created_at");
  });

  it("throws when Supabase returns an error", async () => {
    const error = new Error("select failed");
    const chain = Object.assign(Promise.resolve({ data: null, error }), {
      order: jest.fn((): unknown => chain),
    });
    const select = jest.fn(() => chain);
    const from = jest.fn(() => ({ select }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await expect(getTemplates(supabase)).rejects.toBe(error);
  });
});

describe("createTemplate", () => {
  it("inserts a snake_cased template payload and camelCases the result", async () => {
    const row = {
      id: "template-1",
      title: "Water the plants",
      priority: ETaskPriority.IMPORTANT,
      schedule: "0 0 * * 1",
      list_id: "list-1",
      goal_id: null,
      user_id: "user-1",
    };
    const single = jest.fn(() => Promise.resolve({ data: row, error: null }));
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    const from = jest.fn(() => ({ insert }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    const created = await createTemplate(supabase, {
      title: "Water the plants",
      priority: ETaskPriority.IMPORTANT,
      schedule: "0 0 * * 1",
      listId: "list-1",
    });

    expect(from).toHaveBeenCalledWith("repeat_task_templates");
    expect(insert).toHaveBeenCalledWith({
      title: "Water the plants",
      priority: ETaskPriority.IMPORTANT,
      schedule: "0 0 * * 1",
      list_id: "list-1",
    });
    expect(created).toMatchObject({ id: "template-1", listId: "list-1" });
  });
});

describe("updateTemplate", () => {
  it("updates a snake_cased diff keyed by id", async () => {
    const single = jest.fn(() =>
      Promise.resolve({ data: { id: "template-1" }, error: null }),
    );
    const select = jest.fn(() => ({ single }));
    const eq = jest.fn(() => ({ select }));
    const update = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ update }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await updateTemplate(supabase, {
      id: "template-1",
      schedule: "0 0 15 * *",
      goalId: "goal-1",
    });

    expect(from).toHaveBeenCalledWith("repeat_task_templates");
    expect(update).toHaveBeenCalledWith({
      schedule: "0 0 15 * *",
      goal_id: "goal-1",
    });
    expect(eq).toHaveBeenCalledWith("id", "template-1");
  });
});

describe("deleteTemplate", () => {
  it("deletes the row matching the given id", async () => {
    const eq = jest.fn(() => Promise.resolve({ error: null }));
    const del = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ delete: del }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await deleteTemplate(supabase, "template-1");

    expect(from).toHaveBeenCalledWith("repeat_task_templates");
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("id", "template-1");
  });

  it("throws when Supabase returns an error", async () => {
    const error = new Error("delete failed");
    const eq = jest.fn(() => Promise.resolve({ error }));
    const del = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ delete: del }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await expect(deleteTemplate(supabase, "template-1")).rejects.toBe(error);
  });
});
