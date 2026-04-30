import { applyFilters } from "@/api/applyFilters";

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
