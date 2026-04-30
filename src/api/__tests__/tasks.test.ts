import { SupabaseClient } from "@supabase/supabase-js";

import { getTasks } from "@/api/tasks";
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
