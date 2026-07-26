import { SupabaseClient } from "@supabase/supabase-js";

import { getJournal, upsertJournal } from "@/api/journals";
import { Database } from "@/types/database.types";

// A PostgREST-shaped select builder: `.eq`/`.limit` return the same object so
// calls can chain, and the read resolves through `.maybeSingle()`.
type ChainMock = {
  eq: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
};

const makeSelectClient = (data: unknown, error: Error | null = null) => {
  const chain = {} as ChainMock;
  chain.eq = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(() => Promise.resolve({ data, error }));

  const select = jest.fn(() => chain);
  const from = jest.fn(() => ({ select }));
  return {
    chain,
    select,
    from,
    supabase: { from } as unknown as SupabaseClient<Database>,
  };
};

const makeUpsertClient = (data: unknown, error: Error | null = null) => {
  const single = jest.fn(() => Promise.resolve({ data, error }));
  const select = jest.fn(() => ({ single }));
  const upsert = jest.fn(() => ({ select }));
  const from = jest.fn(() => ({ upsert }));
  return {
    upsert,
    from,
    supabase: { from } as unknown as SupabaseClient<Database>,
  };
};

const prompts = [{ prompt: "Highlight", response: "shipped it" }];

const row = {
  date: "2026-07-12",
  prompts,
  user_id: "user-1",
  created_at: "2026-07-12T00:00:00Z",
};

describe("getJournal", () => {
  it("selects the row for the requested date", async () => {
    const { chain, select, from, supabase } = makeSelectClient(row);

    const journal = await getJournal(supabase, "2026-07-12");

    expect(from).toHaveBeenCalledWith("journals");
    expect(select).toHaveBeenCalledWith("*");
    expect(chain.eq).toHaveBeenCalledWith("date", "2026-07-12");
    expect(journal).toEqual(
      expect.objectContaining({ date: "2026-07-12", prompts }),
    );
  });

  it("coerces a null prompts column to an empty array", async () => {
    const { supabase } = makeSelectClient({ ...row, prompts: null });

    // The column is NOT NULL, but callers `.map()` the array unguarded — a null
    // must never reach the cache regardless of what the row carries.
    const journal = await getJournal(supabase, "2026-07-12");

    expect(journal?.prompts).toEqual([]);
  });

  it("returns null when the day has no row", async () => {
    const { supabase } = makeSelectClient(null);

    await expect(getJournal(supabase, "2026-07-12")).resolves.toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    const error = new Error("select failed");
    const { supabase } = makeSelectClient(null, error);

    await expect(getJournal(supabase, "2026-07-12")).rejects.toBe(error);
  });
});

describe("upsertJournal", () => {
  it("upserts on the (user_id, date) key", async () => {
    const { upsert, from, supabase } = makeUpsertClient(row);

    const journal = await upsertJournal(supabase, {
      date: "2026-07-12",
      prompts,
    });

    expect(from).toHaveBeenCalledWith("journals");
    // `user_id` is never sent (column default + RLS), so the conflict target
    // has to be named explicitly or PostgREST infers it from the payload.
    expect(upsert).toHaveBeenCalledWith(
      { date: "2026-07-12", prompts },
      { onConflict: "user_id,date" },
    );
    expect(journal).toEqual(
      expect.objectContaining({ date: "2026-07-12", prompts }),
    );
  });

  it("throws when Supabase returns an error", async () => {
    const error = new Error("upsert failed");
    const { supabase } = makeUpsertClient(null, error);

    await expect(
      upsertJournal(supabase, { date: "2026-07-12", prompts }),
    ).rejects.toBe(error);
  });
});
