import { applyFilters, dedupeFilters, makeOrFilter } from "@/api/applyFilters";

type QueryMock = {
  calls: string[];
  eq: jest.Mock<QueryMock, [string, unknown]>;
  or: jest.Mock<QueryMock, [string]>;
};

const makeQuery = (calls: string[] = []): QueryMock => ({
  calls,
  eq: jest.fn((column: string, value: unknown) =>
    makeQuery([...calls, `eq:${column}:${String(value)}`]),
  ),
  or: jest.fn((value: string) => makeQuery([...calls, `or:${value}`])),
});

describe("applyFilters", () => {
  it("returns the query produced by each filter call", () => {
    const query = makeQuery();

    const result = applyFilters(query, [
      ["scheduledFor", "eq", "2026-04-30"],
      ["", "or", "status.eq.1,status.eq.2"],
    ]);

    expect(result.calls).toEqual([
      "eq:scheduled_for:2026-04-30",
      "or:status.eq.1,status.eq.2",
    ]);
  });
});

describe("dedupeFilters", () => {
  it("drops an exact-duplicate filter tuple, keeping the first occurrence", () => {
    const filters = dedupeFilters([
      ["status", "in", ["todo", "in_progress"]],
      ["dueOn", "lt", "2026-07-16"],
      ["status", "in", ["todo", "in_progress"]],
    ]);

    expect(filters).toEqual([
      ["status", "in", ["todo", "in_progress"]],
      ["dueOn", "lt", "2026-07-16"],
    ]);
  });

  it("keeps filters on the same column with different operations or values", () => {
    const filters = dedupeFilters([
      ["scheduledFor", "lt", "2026-07-16"],
      ["scheduledFor", "gte", "2026-07-01"],
    ]);

    expect(filters).toHaveLength(2);
  });

  it("returns an empty array unchanged", () => {
    expect(dedupeFilters([])).toEqual([]);
  });
});

describe("makeOrFilter", () => {
  it("wraps in-filter arrays in PostgREST parentheses", () => {
    expect(
      makeOrFilter([
        ["status", "in", [0, 1]],
        ["scheduledFor", "is", null],
      ]),
    ).toEqual(["", "or", "status.in.(0,1),scheduled_for.is.null"]);
  });
});
