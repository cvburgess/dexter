import { TSearchResult } from "@/api/search";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { canOpenSearchResult, searchResultRoute } from "@/utils/searchRoute";

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
  url: null,
  ...overrides,
});

const JOURNAL_ON = { enableJournal: true };
const JOURNAL_OFF = { enableJournal: false };

describe("searchResultRoute", () => {
  it("sends a scheduled task to its day's task list", () => {
    const result: TSearchResult = {
      kind: "task",
      task: makeTask({ scheduledFor: "2026-07-14" }),
    };

    expect(searchResultRoute(result, "milk", "1", JOURNAL_ON)).toEqual({
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
    expect(searchResultRoute(result, "milk", "1", JOURNAL_ON)).toEqual({
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

      expect(canOpenSearchResult(result, JOURNAL_ON)).toBe(false);
      expect(searchResultRoute(result, "milk", "1", JOURNAL_ON)).toBeNull();
    }
  });

  it("still routes a completed task that has a day to open", () => {
    const result: TSearchResult = {
      kind: "task",
      task: makeTask({ scheduledFor: "2026-07-14", status: ETaskStatus.DONE }),
    };

    expect(canOpenSearchResult(result, JOURNAL_ON)).toBe(true);
    expect(searchResultRoute(result, "milk", "1", JOURNAL_ON)).toEqual({
      pathname: "/today",
      params: { date: "2026-07-14", mode: "tasks", n: "1" },
    });
  });

  it("sends a note to its day's notes view", () => {
    const result: TSearchResult = {
      kind: "note",
      date: "2026-07-13",
      content: "bought the milk",
    };

    // A note has no completion state, so it can never hit the case above.
    expect(canOpenSearchResult(result, JOURNAL_OFF)).toBe(true);
    expect(searchResultRoute(result, "milk", "1", JOURNAL_ON)).toEqual({
      pathname: "/today",
      params: { date: "2026-07-13", mode: "notes", n: "1" },
    });
  });

  const journalResult: TSearchResult = {
    kind: "journal",
    date: "2026-07-12",
    prompt: "What went well?",
    content: "remembered the milk",
  };

  // DEX-105: the journal left the Today tab, so this is the one result that
  // opens a different tab entirely.
  it("sends a journal entry to its day's ritual journal step", () => {
    expect(canOpenSearchResult(journalResult, JOURNAL_ON)).toBe(true);
    expect(searchResultRoute(journalResult, "milk", "1", JOURNAL_ON)).toEqual({
      pathname: "/ritual",
      params: { date: "2026-07-12", step: "journal", n: "1" },
    });
  });

  it("refuses to route a journal entry when the journal is disabled", () => {
    // The ritual has no journal step for that user, so the link would switch
    // tabs and land on whichever step happens to be first. Old entries stay
    // searchable and readable — only the tap target goes.
    expect(canOpenSearchResult(journalResult, JOURNAL_OFF)).toBe(false);
    expect(
      searchResultRoute(journalResult, "milk", "1", JOURNAL_OFF),
    ).toBeNull();
  });
});
