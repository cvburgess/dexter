import { Temporal } from "@js-temporal/polyfill";

import { TSearchResult } from "@/api/search";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import {
  canOpenSearchResult,
  parseDayDate,
  parseDayLink,
  parseDayMode,
  searchResultRoute,
  todayRoute,
} from "@/utils/todayRoute";

const makeTask = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: "2026-07-14",
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  title: "Buy milk",
  ...overrides,
});

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
    for (const mode of ["tasks", "notes", "journal", "backlog"] as const) {
      expect(parseDayMode(mode)).toBe(mode);
    }
  });

  it("rejects an unknown mode rather than passing it through", () => {
    // `calendar` is a real day view but nothing links to it — there is nothing
    // in a calendar event to search.
    expect(parseDayMode("calendar")).toBeNull();
    expect(parseDayMode(undefined)).toBeNull();
    expect(parseDayMode("")).toBeNull();
  });

  it("takes the first value when a param is repeated in the URL", () => {
    expect(parseDayMode(["notes", "journal"])).toBe("notes");
  });
});

describe("parseDayDate", () => {
  it("parses an ISO date", () => {
    expect(parseDayDate("2026-07-14")).toEqual(
      Temporal.PlainDate.from("2026-07-14"),
    );
  });

  it("returns null for a malformed or impossible date instead of throwing", () => {
    // The route is linkable on web, so a hand-edited or stale URL is a real
    // source of garbage; the tab falls back to today rather than crashing.
    expect(parseDayDate("not-a-date")).toBeNull();
    expect(parseDayDate("2026-02-30")).toBeNull();
    expect(parseDayDate(undefined)).toBeNull();
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
    // The whole point: cross-tab navigation reuses the mounted Today screen and
    // only swaps its params, so a value-based comparison can't tell "already
    // applied" from "applied, user navigated away, and asked again".
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
      mode: ["journal", "notes"],
      q: ["milk", "bread"],
      n: ["1"],
    });

    expect(link?.date).toBeNull();
    expect(link?.mode).toBe("journal");
    expect(link?.query).toBe("milk");
  });
});

describe("searchResultRoute", () => {
  it("sends a scheduled task to its day's task list", () => {
    const result: TSearchResult = {
      kind: "task",
      task: makeTask({ scheduledFor: "2026-07-14" }),
    };

    expect(searchResultRoute(result, "milk", "1")).toEqual({
      pathname: "/today",
      params: { date: "2026-07-14", mode: "tasks", n: "1" },
    });
  });

  it("sends an unscheduled task to the backlog, carrying the query", () => {
    const result: TSearchResult = {
      kind: "task",
      task: makeTask({ scheduledFor: null, status: ETaskStatus.TODO }),
    };

    // No day to open, so the drawer seeds its own search box from `q` and the
    // task is on screen immediately instead of buried in the backlog.
    expect(searchResultRoute(result, "milk", "1")).toEqual({
      pathname: "/today",
      params: { mode: "backlog", q: "milk", n: "1" },
    });
  });

  it("refuses to route a completed, unscheduled task anywhere", () => {
    // The backlog can never show it — `selectBacklogTasks` filters to
    // incomplete tasks, and the canonical fetch excludes completed rows with a
    // null `scheduledFor` outright — so linking it would open an empty drawer.
    for (const status of [
      ETaskStatus.DONE,
      ETaskStatus.WONT_DO,
      ETaskStatus.DELEGATED,
    ]) {
      const result: TSearchResult = {
        kind: "task",
        task: makeTask({ scheduledFor: null, status }),
      };

      expect(canOpenSearchResult(result)).toBe(false);
      expect(searchResultRoute(result, "milk", "1")).toBeNull();
    }
  });

  it("still routes a completed task that has a day to open", () => {
    const result: TSearchResult = {
      kind: "task",
      task: makeTask({ scheduledFor: "2026-07-14", status: ETaskStatus.DONE }),
    };

    expect(canOpenSearchResult(result)).toBe(true);
    expect(searchResultRoute(result, "milk", "1")).toEqual({
      pathname: "/today",
      params: { date: "2026-07-14", mode: "tasks", n: "1" },
    });
  });

  it("always routes notes and journal entries", () => {
    // Neither has a completion state, so neither can hit the case above.
    expect(
      canOpenSearchResult({
        kind: "note",
        date: "2026-07-13",
        content: "x",
      }),
    ).toBe(true);
  });

  it("sends a note to its day's notes view", () => {
    const result: TSearchResult = {
      kind: "note",
      date: "2026-07-13",
      content: "bought the milk",
    };

    expect(searchResultRoute(result, "milk", "1")).toEqual({
      pathname: "/today",
      params: { date: "2026-07-13", mode: "notes", n: "1" },
    });
  });

  it("sends a journal entry to its day's journal view", () => {
    const result: TSearchResult = {
      kind: "journal",
      date: "2026-07-12",
      prompt: "What went well?",
      content: "remembered the milk",
    };

    expect(searchResultRoute(result, "milk", "1")).toEqual({
      pathname: "/today",
      params: { date: "2026-07-12", mode: "journal", n: "1" },
    });
  });
});
