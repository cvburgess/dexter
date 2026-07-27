import { SupabaseClient } from "@supabase/supabase-js";

import { searchEntries } from "@/api/search";
import { ETaskPriority, ETaskStatus } from "@/api/tasks";
import { Database } from "@/types/database.types";

type RpcResult = { data: unknown; error: Error | null };

const makeClient = (data: unknown, error: Error | null = null) => {
  const rpc = jest.fn(() => Promise.resolve({ data, error }));
  return {
    rpc,
    supabase: { rpc } as unknown as SupabaseClient<Database>,
  };
};

/** A `tasks` row as the RPC returns it — snake_case, straight from `to_jsonb`. */
const taskRow = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  alarm_time: null,
  due_on: null,
  goal_id: null,
  list_id: null,
  priority: ETaskPriority.URGENT,
  scheduled_for: "2026-07-14",
  status: ETaskStatus.TODO,
  subtasks: [],
  template_id: null,
  title: "Buy milk",
  user_id: "user-1",
  ...overrides,
});

describe("searchEntries", () => {
  it("passes the query to the RPC untouched", async () => {
    const { rpc, supabase } = makeClient([]);

    await searchEntries(supabase, "50% off");

    // Escaping here would double-escape what `search_entries` already handles.
    expect(rpc).toHaveBeenCalledWith("search_entries", { query: "50% off" });
  });

  it("camelCases a task row and guarantees its subtasks array", async () => {
    const { supabase } = makeClient([
      {
        kind: "task",
        entry_date: "2026-07-14",
        task: taskRow({ subtasks: undefined }),
        prompt: null,
        content: null,
      },
    ]);

    const results = await searchEntries(supabase, "milk");

    expect(results).toEqual([
      {
        kind: "task",
        task: expect.objectContaining({
          id: "task-1",
          // The deep camelCase walk has to reach inside the jsonb payload, or
          // TaskCard reads undefined for every multi-word column.
          scheduledFor: "2026-07-14",
          alarmTime: null,
          title: "Buy milk",
          // A bundle running ahead of the subtasks migration gets rows without
          // the column, and every consumer dereferences it unguarded.
          subtasks: [],
        }),
      },
    ]);
  });

  it("maps note and journal rows onto their result shapes", async () => {
    const { supabase } = makeClient([
      {
        kind: "note",
        entry_date: "2026-07-13",
        task: null,
        prompt: null,
        content: "bought the milk",
      },
      {
        kind: "journal",
        entry_date: "2026-07-12",
        task: null,
        prompt: "What went well?",
        content: "remembered the milk",
      },
    ]);

    expect(await searchEntries(supabase, "milk")).toEqual([
      { kind: "note", date: "2026-07-13", content: "bought the milk" },
      {
        kind: "journal",
        date: "2026-07-12",
        prompt: "What went well?",
        content: "remembered the milk",
      },
    ]);
  });

  it("keeps a journal entry that matched on only one of its two fields", async () => {
    const { supabase } = makeClient([
      {
        kind: "journal",
        entry_date: "2026-07-12",
        task: null,
        prompt: "What went well?",
        // An answered-nothing prompt still matches on the question.
        content: null,
      },
    ]);

    expect(await searchEntries(supabase, "well")).toEqual([
      {
        kind: "journal",
        date: "2026-07-12",
        prompt: "What went well?",
        content: "",
      },
    ]);
  });

  it("drops rows that could not be rendered or navigated to", async () => {
    const { supabase } = makeClient([
      // A task with no row can't be rendered as a card...
      {
        kind: "task",
        entry_date: null,
        task: null,
        prompt: null,
        content: null,
      },
      // ...a note with no date can't be navigated to...
      {
        kind: "note",
        entry_date: null,
        task: null,
        prompt: null,
        content: "x",
      },
      // ...and an unknown kind is a client running behind the database.
      {
        kind: "habit",
        entry_date: "2026-07-12",
        task: null,
        prompt: null,
        content: "x",
      },
    ]);

    expect(await searchEntries(supabase, "x")).toEqual([]);
  });

  it("returns an empty list when the RPC yields no rows", async () => {
    const { supabase } = makeClient(null);

    expect(await searchEntries(supabase, "nothing")).toEqual([]);
  });

  it("throws the RPC's error", async () => {
    const error = new Error("boom");
    const { supabase } = makeClient(null, error);

    await expect(searchEntries(supabase, "milk")).rejects.toBe(error);
  });
});
