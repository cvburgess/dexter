import { Temporal } from "@js-temporal/polyfill";

import { parseDayLink, parseDayMode, todayRoute } from "@/utils/todayRoute";

describe("todayRoute", () => {
  it("returns the bare tab route when given nothing to point at", () => {
    expect(todayRoute()).toBe("/today");
  });

  it("drops params that were left undefined or blank", () => {
    expect(todayRoute({ date: "2026-07-14", mode: "backlog", q: "" })).toEqual({
      pathname: "/today",
      params: { date: "2026-07-14", mode: "backlog" },
    });
  });
});

describe("parseDayMode", () => {
  it("accepts every mode the Today tab knows", () => {
    for (const mode of ["tasks", "notes", "backlog"] as const) {
      expect(parseDayMode(mode)).toBe(mode);
    }
  });

  it("rejects an unknown mode rather than passing it through", () => {
    // Nothing links to `calendar`, and `journal` moved to ritualRoute (DEX-105)
    // — a stale `?mode=journal` URL must fall through to Tasks.
    expect(parseDayMode("calendar")).toBeNull();
    expect(parseDayMode("journal")).toBeNull();
    expect(parseDayMode(undefined)).toBeNull();
    expect(parseDayMode("")).toBeNull();
  });

  it("takes the first value when a param is repeated in the URL", () => {
    expect(parseDayMode(["notes", "tasks"])).toBe("notes");
  });
});

describe("parseDayLink", () => {
  it("returns null when the route names neither a day nor a surface", () => {
    // An ordinary tab press — the Today tab must behave as if nothing was asked
    // for, rather than applying an empty link.
    expect(parseDayLink({})).toBeNull();
    expect(parseDayLink({ q: "milk" })).toBeNull();
  });

  it("gives two follows of the same link different ids", () => {
    // Cross-tab navigation only swaps params, so a value-based comparison
    // can't tell "already applied" from "applied, left, and asked again".
    const first = parseDayLink({ date: "2026-07-14", mode: "notes", n: "1" });
    const second = parseDayLink({ date: "2026-07-14", mode: "notes", n: "2" });

    expect(first?.id).not.toBe(second?.id);
    expect(second?.date).toEqual(Temporal.PlainDate.from("2026-07-14"));
    expect(second?.mode).toBe("notes");
  });

  it("gives a link with no nonce a stable id, so it applies exactly once", () => {
    // A hand-typed or bookmarked URL carries no `n`. Re-rendering must not
    // re-apply it and yank the user back to that day.
    const link = parseDayLink({ date: "2026-07-14", mode: "notes" });
    const again = parseDayLink({ date: "2026-07-14", mode: "notes" });

    expect(link?.id).toBe(again?.id);
  });

  it("distinguishes links that differ only in their query", () => {
    const first = parseDayLink({ mode: "backlog", q: "milk", n: "1" });
    const second = parseDayLink({ mode: "backlog", q: "bread", n: "1" });

    expect(first?.id).not.toBe(second?.id);
    expect(first?.query).toBe("milk");
  });

  it("narrows repeated params and drops an unparseable date", () => {
    const link = parseDayLink({
      date: ["2026-02-30"],
      mode: ["backlog", "notes"],
      q: ["milk", "bread"],
      n: ["1"],
    });

    expect(link?.date).toBeNull();
    expect(link?.mode).toBe("backlog");
    expect(link?.query).toBe("milk");
  });
});
