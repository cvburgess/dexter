import { SupabaseClient } from "@supabase/supabase-js";

import { getNote, upsertNote } from "@/api/notes";
import { Database } from "@/types/database.types";

// A thenable query builder: awaiting it resolves the row, and `.eq`/`.limit`
// return the same builder so calls can chain (mirrors PostgREST's builder).
type ChainMock = {
  eq: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
};

const makeSelectChain = (data: unknown): ChainMock => {
  const chain = {} as ChainMock;
  chain.eq = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(() => Promise.resolve({ data, error: null }));
  return chain;
};

describe("getNote", () => {
  it("selects the row for the requested date", async () => {
    const chain = makeSelectChain({
      date: "2026-07-12",
      content: "hello",
      user_id: "user-1",
      created_at: "2026-07-12T00:00:00Z",
    });
    const select = jest.fn(() => chain);
    const from = jest.fn(() => ({ select }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    const note = await getNote(supabase, "2026-07-12");

    expect(from).toHaveBeenCalledWith("notes");
    expect(select).toHaveBeenCalledWith("*");
    expect(chain.eq).toHaveBeenCalledWith("date", "2026-07-12");
    expect(note).toEqual(
      expect.objectContaining({ date: "2026-07-12", content: "hello" }),
    );
  });

  it("returns null when the day has no row", async () => {
    const chain = makeSelectChain(null);
    const select = jest.fn(() => chain);
    const from = jest.fn(() => ({ select }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    // Distinct from an empty note: callers use this to tell "never started"
    // apart from "started but blank" (the template chooser depends on it).
    await expect(getNote(supabase, "2026-07-12")).resolves.toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    const error = new Error("select failed");
    const chain = {} as ChainMock;
    chain.eq = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);
    chain.maybeSingle = jest.fn(() =>
      Promise.resolve({ data: null, error }),
    ) as jest.Mock;
    const select = jest.fn(() => chain);
    const from = jest.fn(() => ({ select }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await expect(getNote(supabase, "2026-07-12")).rejects.toBe(error);
  });
});

describe("upsertNote", () => {
  it("upserts on the (user_id, date) key", async () => {
    const row = {
      date: "2026-07-12",
      content: "hello",
      user_id: "user-1",
      created_at: "2026-07-12T00:00:00Z",
    };
    const single = jest.fn(() => Promise.resolve({ data: row, error: null }));
    const select = jest.fn(() => ({ single }));
    const upsert = jest.fn(() => ({ select }));
    const from = jest.fn(() => ({ upsert }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    const note = await upsertNote(supabase, {
      date: "2026-07-12",
      content: "hello",
    });

    expect(from).toHaveBeenCalledWith("notes");
    // `user_id` is never sent (column default + RLS), so the conflict target
    // has to be named explicitly or PostgREST infers it from the payload.
    expect(upsert).toHaveBeenCalledWith(
      { date: "2026-07-12", content: "hello" },
      { onConflict: "user_id,date" },
    );
    expect(note).toEqual(
      expect.objectContaining({ date: "2026-07-12", content: "hello" }),
    );
  });

  it("throws when Supabase returns an error", async () => {
    const error = new Error("upsert failed");
    const single = jest.fn(() => Promise.resolve({ data: null, error }));
    const select = jest.fn(() => ({ single }));
    const upsert = jest.fn(() => ({ select }));
    const from = jest.fn(() => ({ upsert }));
    const supabase = { from } as unknown as SupabaseClient<Database>;

    await expect(
      upsertNote(supabase, { date: "2026-07-12", content: "hello" }),
    ).rejects.toBe(error);
  });
});
