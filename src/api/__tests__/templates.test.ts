import { SupabaseClient } from "@supabase/supabase-js";

import { ETaskPriority } from "@/api/tasks";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  isTaskTemplate,
  TTemplate,
  updateTemplate,
} from "@/api/templates";
import { Database } from "@/types/database.types";

describe("getTemplates", () => {
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

  // The column has no default since DEX-65, so a null schedule has to travel to
  // Postgres as an explicit null — dropping it would leave the row incomplete.
  it("sends an explicit null schedule for a task template", async () => {
    const single = jest.fn(() =>
      Promise.resolve({
        data: { id: "template-2", schedule: null },
        error: null,
      }),
    );
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    const from = jest.fn(() => ({ insert }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    const created = await createTemplate(supabase, {
      title: "Trip packing",
      priority: ETaskPriority.NEITHER,
      schedule: null,
    });

    expect(insert).toHaveBeenCalledWith({
      title: "Trip packing",
      priority: ETaskPriority.NEITHER,
      schedule: null,
    });
    expect(isTaskTemplate(created)).toBe(true);
  });
});

describe("isTaskTemplate", () => {
  it("treats a scheduleless row as a template and a scheduled one as a repeat", () => {
    expect(isTaskTemplate({ schedule: null } as TTemplate)).toBe(true);
    expect(isTaskTemplate({ schedule: "0 0 * * *" } as TTemplate)).toBe(false);
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

  // Turning a repeat back into a template. `snakeCase` must keep the null
  // rather than drop the key, or the schedule would silently stay put.
  it("clears the schedule when null is passed", async () => {
    const single = jest.fn(() =>
      Promise.resolve({ data: { id: "template-1" }, error: null }),
    );
    const select = jest.fn(() => ({ single }));
    const eq = jest.fn(() => ({ select }));
    const update = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ update }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await updateTemplate(supabase, { id: "template-1", schedule: null });

    expect(update).toHaveBeenCalledWith({ schedule: null });
  });
});

describe("deleteTemplate", () => {
  it("throws when Supabase returns an error", async () => {
    const error = new Error("delete failed");
    const eq = jest.fn(() => Promise.resolve({ error }));
    const del = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ delete: del }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await expect(deleteTemplate(supabase, "template-1")).rejects.toBe(error);
  });
});
