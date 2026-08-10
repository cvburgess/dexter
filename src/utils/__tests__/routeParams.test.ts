import { Temporal } from "@js-temporal/polyfill";

import { firstParam, linkNonce, parseDayDate } from "@/utils/routeParams";

describe("firstParam", () => {
  it("takes the first value when a key is repeated in the URL", () => {
    expect(firstParam(["notes", "tasks"])).toBe("notes");
    expect(firstParam("notes")).toBe("notes");
    expect(firstParam(undefined)).toBeUndefined();
  });
});

describe("parseDayDate", () => {
  it("parses an ISO date", () => {
    expect(parseDayDate("2026-07-14")).toEqual(
      Temporal.PlainDate.from("2026-07-14"),
    );
  });

  it("returns null for a malformed or impossible date instead of throwing", () => {
    // These routes are linkable on web, so a hand-edited or stale URL is a real
    // source of garbage; the tab falls back to today rather than crashing.
    expect(parseDayDate("not-a-date")).toBeNull();
    expect(parseDayDate("2026-02-30")).toBeNull();
    expect(parseDayDate(undefined)).toBeNull();
  });
});

describe("linkNonce", () => {
  it("is the empty string when the URL carries no nonce", () => {
    // A hand-typed or bookmarked URL has no `n`, which is what makes its link
    // id derive from its contents alone and apply exactly once.
    expect(linkNonce(undefined)).toBe("");
    expect(linkNonce("3")).toBe("3");
  });
});
