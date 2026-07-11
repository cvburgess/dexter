import { SupabaseClient } from "@supabase/supabase-js";

import {
  createHabit,
  deleteHabit,
  getDailyHabits,
  getHabits,
  updateDailyHabit,
} from "@/api/habits";
import { Database } from "@/types/database.types";

// A thenable query builder: awaiting it resolves rows, and `.eq`/`.order`
// return the same builder so calls can chain (mirrors PostgREST's builder).
type ChainMock = Promise<{ data: unknown[]; error: null }> & {
  eq: jest.Mock;
  order: jest.Mock;
};

const makeChain = (data: unknown[] = []): ChainMock => {
  const chain = Promise.resolve({ data, error: null }) as ChainMock;
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  return chain;
};

describe("getHabits", () => {
  it("selects non-archived habits ordered by title", async () => {
    const chain = makeChain();
    const select = jest.fn(() => chain);
    const from = jest.fn(() => ({ select }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await getHabits(supabase);

    expect(from).toHaveBeenCalledWith("habits");
    expect(select).toHaveBeenCalledWith("*");
    expect(chain.eq).toHaveBeenCalledWith("is_archived", false);
    expect(chain.order).toHaveBeenCalledWith("title");
  });

  it("throws when Supabase returns an error", async () => {
    const error = new Error("select failed");
    const chain = Object.assign(Promise.resolve({ data: null, error }), {
      eq: jest.fn((): unknown => chain),
      order: jest.fn((): unknown => chain),
    });
    const select = jest.fn(() => chain);
    const from = jest.fn(() => ({ select }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await expect(getHabits(supabase)).rejects.toBe(error);
  });
});

describe("createHabit", () => {
  it("inserts a snake_cased habit payload", async () => {
    const row = {
      id: "habit-1",
      title: "Read",
      emoji: "📖",
      steps: 1,
      days_active: [1, 2, 3],
      is_paused: false,
      is_archived: false,
    };
    const single = jest.fn(() => Promise.resolve({ data: row, error: null }));
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    const from = jest.fn(() => ({ insert }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    const created = await createHabit(supabase, {
      title: "Read",
      emoji: "📖",
      steps: 1,
      daysActive: [1, 2, 3],
    });

    expect(from).toHaveBeenCalledWith("habits");
    expect(insert).toHaveBeenCalledWith({
      title: "Read",
      emoji: "📖",
      steps: 1,
      days_active: [1, 2, 3],
    });
    // The row is camelCased back into the domain type.
    expect(created).toMatchObject({ id: "habit-1", daysActive: [1, 2, 3] });
  });
});

describe("getDailyHabits", () => {
  it("joins the parent habit and filters by date", async () => {
    const chain = makeChain();
    const select = jest.fn(() => chain);
    const from = jest.fn(() => ({ select }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await getDailyHabits(supabase, "2026-07-11");

    expect(from).toHaveBeenCalledWith("daily_habits");
    expect(select).toHaveBeenCalledWith("*, habits(*)");
    expect(chain.eq).toHaveBeenCalledWith("date", "2026-07-11");
    expect(chain.order).toHaveBeenCalledWith("habit_id");
  });
});

describe("updateDailyHabit", () => {
  it("writes only steps_complete, keyed by date and habit", async () => {
    const single = jest.fn(() =>
      Promise.resolve({ data: { habit_id: "habit-1" }, error: null }),
    );
    const select = jest.fn(() => ({ single }));
    const eqHabit = jest.fn(() => ({ select }));
    const eqDate = jest.fn(() => ({ eq: eqHabit }));
    const update = jest.fn(() => ({ eq: eqDate }));
    const from = jest.fn(() => ({ update }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await updateDailyHabit(supabase, {
      date: "2026-07-11",
      habitId: "habit-1",
      stepsComplete: 3,
    });

    expect(from).toHaveBeenCalledWith("daily_habits");
    // Never the generated `percent_complete` column, never `user_id`.
    expect(update).toHaveBeenCalledWith({ steps_complete: 3 });
    expect(eqDate).toHaveBeenCalledWith("date", "2026-07-11");
    expect(eqHabit).toHaveBeenCalledWith("habit_id", "habit-1");
  });
});

describe("deleteHabit", () => {
  it("deletes the row matching the given id", async () => {
    const eq = jest.fn(() => Promise.resolve({ error: null }));
    const del = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ delete: del }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await deleteHabit(supabase, "habit-1");

    expect(from).toHaveBeenCalledWith("habits");
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("id", "habit-1");
  });
});
