import { Temporal } from "@js-temporal/polyfill";

import { TSearchResult } from "@/api/search";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import {
  parseDayDate,
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

describe("searchResultRoute", () => {
  it("sends a scheduled task to its day's task list", () => {
    const result: TSearchResult = {
      kind: "task",
      task: makeTask({ scheduledFor: "2026-07-14" }),
    };

    expect(searchResultRoute(result, "milk")).toEqual({
      pathname: "/today",
      params: { date: "2026-07-14", mode: "tasks" },
    });
  });

  it("sends an unscheduled task to the backlog, carrying the query", () => {
    const result: TSearchResult = {
      kind: "task",
      task: makeTask({ scheduledFor: null }),
    };

    // No day to open, so the drawer seeds its own search box from `q` and the
    // task is on screen immediately instead of buried in the backlog.
    expect(searchResultRoute(result, "milk")).toEqual({
      pathname: "/today",
      params: { mode: "backlog", q: "milk" },
    });
  });

  it("sends a note to its day's notes view", () => {
    const result: TSearchResult = {
      kind: "note",
      date: "2026-07-13",
      content: "bought the milk",
    };

    expect(searchResultRoute(result, "milk")).toEqual({
      pathname: "/today",
      params: { date: "2026-07-13", mode: "notes" },
    });
  });

  it("sends a journal entry to its day's journal view", () => {
    const result: TSearchResult = {
      kind: "journal",
      date: "2026-07-12",
      prompt: "What went well?",
      content: "remembered the milk",
    };

    expect(searchResultRoute(result, "milk")).toEqual({
      pathname: "/today",
      params: { date: "2026-07-12", mode: "journal" },
    });
  });
});
