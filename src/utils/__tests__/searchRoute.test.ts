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

// Prompts in both rituals, so the journal has a step in each and these cases
// say nothing about which one a link picks (DEX-151 covers that below).
const JOURNAL_ON = {
  enableJournal: true,
  templatePrompts: [
    { id: "a", prompt: "Highlight", period: "am" as const },
    { id: "b", prompt: "What went well?", period: "pm" as const },
  ],
};
const JOURNAL_OFF = {
  ...JOURNAL_ON,
  enableJournal: false,
};

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
    // The backlog can never show a completed, unscheduled task, so linking
    // it would open an empty drawer.
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

  // DEX-105: the journal left the Today tab. DEX-151: the link names the
  // ritual rather than letting the clock pick one with no journal step.
  it("sends a journal entry to the ritual that still asks that question", () => {
    expect(canOpenSearchResult(journalResult, JOURNAL_ON)).toBe(true);
    expect(searchResultRoute(journalResult, "milk", "1", JOURNAL_ON)).toEqual({
      pathname: "/ritual",
      params: { date: "2026-07-12", mode: "pm", step: "journal", n: "1" },
    });
  });

  it("sends it to the morning when that is where the prompt lives", () => {
    const options = {
      ...JOURNAL_ON,
      templatePrompts: [
        { id: "a", prompt: "What went well?", period: "am" as const },
        { id: "b", prompt: "Anything else?", period: "pm" as const },
      ],
    };

    expect(searchResultRoute(journalResult, "milk", "1", options)).toEqual({
      pathname: "/ritual",
      params: { date: "2026-07-12", mode: "am", step: "journal", n: "1" },
    });
  });

  // The prompt may have been renamed or deleted since the day was written, so
  // the entry lands in whichever ritual still has a Journal step.
  it("falls back to the only ritual with prompts when the prompt is gone", () => {
    const eveningOnly = {
      ...JOURNAL_ON,
      templatePrompts: [
        { id: "a", prompt: "Something else entirely", period: "pm" as const },
      ],
    };

    expect(searchResultRoute(journalResult, "milk", "1", eveningOnly)).toEqual({
      pathname: "/ritual",
      params: { date: "2026-07-12", mode: "pm", step: "journal", n: "1" },
    });
  });

  it("prefers the morning when the prompt is in neither list", () => {
    const both = {
      ...JOURNAL_ON,
      templatePrompts: [
        { id: "a", prompt: "Something else", period: "am" as const },
        { id: "b", prompt: "Something else again", period: "pm" as const },
      ],
    };

    expect(searchResultRoute(journalResult, "milk", "1", both)).toMatchObject({
      params: expect.objectContaining({ mode: "am" }),
    });
  });

  it("refuses to route a journal entry when the journal is disabled", () => {
    // With no journal step the link would land on an arbitrary step. Old
    // entries stay searchable and readable — only the tap target goes.
    expect(canOpenSearchResult(journalResult, JOURNAL_OFF)).toBe(false);
    expect(
      searchResultRoute(journalResult, "milk", "1", JOURNAL_OFF),
    ).toBeNull();
  });

  // Neither ritual has a Journal step, so this is the same dead end as the
  // preference being off — the tap would land on whatever step comes first.
  it("refuses to route a journal entry when no ritual has prompts", () => {
    const noPrompts = { ...JOURNAL_ON, templatePrompts: [] };

    expect(canOpenSearchResult(journalResult, noPrompts)).toBe(false);
    expect(searchResultRoute(journalResult, "milk", "1", noPrompts)).toBeNull();
  });
});
