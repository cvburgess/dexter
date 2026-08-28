import { Temporal } from "@js-temporal/polyfill";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { weekDays } from "@/utils/weekStartEnd";

import {
  backlogAttentionFilter,
  backlogCounts,
  defaultBacklogFilter,
  filterMenuCounts,
  nextBacklogFilter,
  filterTasks,
  isCompletionStatus,
  selectBacklogTasks,
  selectCompletedTasksForDate,
  selectOpenTasksForDate,
  selectTasksForDate,
} from "../taskFilters";

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  title: "Write report",
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.URGENT,
  scheduledFor: null,
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  url: null,
  ...overrides,
});

const date = Temporal.PlainDate.from("2026-07-16");

describe("isCompletionStatus", () => {
  it("is true only for DONE, WONT_DO, and DELEGATED", () => {
    expect(isCompletionStatus(ETaskStatus.DONE)).toBe(true);
    expect(isCompletionStatus(ETaskStatus.WONT_DO)).toBe(true);
    expect(isCompletionStatus(ETaskStatus.DELEGATED)).toBe(true);
    expect(isCompletionStatus(ETaskStatus.TODO)).toBe(false);
    expect(isCompletionStatus(ETaskStatus.IN_PROGRESS)).toBe(false);
    expect(isCompletionStatus(undefined)).toBe(false);
  });
});

describe("selectTasksForDate", () => {
  it("returns tasks scheduled for the date regardless of status", () => {
    const tasks = [
      task({ id: "1", scheduledFor: "2026-07-16", status: ETaskStatus.DONE }),
      task({ id: "2", scheduledFor: "2026-07-16", status: ETaskStatus.TODO }),
      task({ id: "3", scheduledFor: "2026-07-17" }),
      task({ id: "4", scheduledFor: null }),
    ];

    expect(selectTasksForDate(tasks, date).map((t) => t.id)).toEqual([
      "1",
      "2",
    ]);
  });

  it("preserves input order", () => {
    const tasks = [
      task({ id: "2", scheduledFor: "2026-07-16" }),
      task({ id: "1", scheduledFor: "2026-07-16" }),
    ];

    expect(selectTasksForDate(tasks, date).map((t) => t.id)).toEqual([
      "2",
      "1",
    ]);
  });
});

describe("selectOpenTasksForDate", () => {
  // Every terminal status drops out — DELEGATED and WONT_DO are "closed"
  // without being finished, the two a hand-written `=== DONE` check would miss.
  it("keeps only the day's tasks nobody has closed out", () => {
    const tasks = [
      task({
        id: "todo",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.TODO,
      }),
      task({
        id: "doing",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.IN_PROGRESS,
      }),
      task({
        id: "done",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.DONE,
      }),
      task({
        id: "wont",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.WONT_DO,
      }),
      task({
        id: "delegated",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.DELEGATED,
      }),
    ];

    expect(selectOpenTasksForDate(tasks, date).map((t) => t.id)).toEqual([
      "todo",
      "doing",
    ]);
  });

  // Scope is the ritual's own day (DEX-146): stragglers and the unscheduled
  // backlog are the morning Backlog step's job, not the evening list's.
  it("ignores other days and the unscheduled backlog", () => {
    const tasks = [
      task({ id: "yesterday", scheduledFor: "2026-07-15" }),
      task({ id: "today", scheduledFor: "2026-07-16" }),
      task({ id: "tomorrow", scheduledFor: "2026-07-17" }),
      task({ id: "unscheduled", scheduledFor: null }),
    ];

    expect(selectOpenTasksForDate(tasks, date).map((t) => t.id)).toEqual([
      "today",
    ]);
  });
});

describe("selectCompletedTasksForDate", () => {
  // DEX-148: abandoning or handing off both count as putting a task down, so
  // the two selectors partition the day — WONT_DO/DELEGATED land in neither otherwise.
  it("keeps every terminal status, not just DONE", () => {
    const tasks = [
      task({
        id: "todo",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.TODO,
      }),
      task({
        id: "doing",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.IN_PROGRESS,
      }),
      task({
        id: "done",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.DONE,
      }),
      task({
        id: "wont",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.WONT_DO,
      }),
      task({
        id: "delegated",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.DELEGATED,
      }),
    ];

    expect(selectCompletedTasksForDate(tasks, date).map((t) => t.id)).toEqual([
      "done",
      "wont",
      "delegated",
    ]);
  });

  // Scope is `scheduledFor` — no completion timestamp exists: a task finished
  // today but scheduled for yesterday is yesterday's review.
  it("ignores other days and the unscheduled backlog", () => {
    const tasks = [
      task({
        id: "yesterday",
        scheduledFor: "2026-07-15",
        status: ETaskStatus.DONE,
      }),
      task({
        id: "today",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.DONE,
      }),
      task({
        id: "unscheduled",
        scheduledFor: null,
        status: ETaskStatus.DONE,
      }),
    ];

    expect(selectCompletedTasksForDate(tasks, date).map((t) => t.id)).toEqual([
      "today",
    ]);
  });

  // No task scheduled for the day falls outside both selectors — the evening's
  // two steps partition it rather than overlap.
  it("partitions the day with selectOpenTasksForDate", () => {
    const tasks = [
      ETaskStatus.TODO,
      ETaskStatus.IN_PROGRESS,
      ETaskStatus.DONE,
      ETaskStatus.WONT_DO,
      ETaskStatus.DELEGATED,
    ].map((status) =>
      task({ id: String(status), scheduledFor: "2026-07-16", status }),
    );

    expect([
      ...selectOpenTasksForDate(tasks, date),
      ...selectCompletedTasksForDate(tasks, date),
    ]).toHaveLength(tasks.length);
  });
});

describe("selectBacklogTasks over a whole week (DEX-96)", () => {
  // 2026-07-27 (Mon) – 2026-08-02 (Sun).
  const monday = Temporal.PlainDate.from("2026-07-27");

  it("excludes every day of the week, including both boundaries", () => {
    const tasks = [
      task({ id: "sun-before", scheduledFor: "2026-07-26" }),
      task({ id: "mon", scheduledFor: "2026-07-27" }),
      task({ id: "thu", scheduledFor: "2026-07-30" }),
      task({ id: "sun", scheduledFor: "2026-08-02" }),
      task({ id: "mon-after", scheduledFor: "2026-08-03" }),
    ];

    expect(
      selectBacklogTasks(tasks, weekDays(monday)).map((t) => t.id),
    ).toEqual(["sun-before", "mon-after"]);
  });

  it("includes unscheduled incomplete tasks", () => {
    const tasks = [task({ id: "1", scheduledFor: null })];

    expect(
      selectBacklogTasks(tasks, weekDays(monday)).map((t) => t.id),
    ).toEqual(["1"]);
  });

  it("excludes completed tasks even when scheduled outside the week", () => {
    const tasks = [
      task({
        id: "done",
        scheduledFor: "2026-07-01",
        status: ETaskStatus.DONE,
      }),
      task({
        id: "wont",
        scheduledFor: null,
        status: ETaskStatus.WONT_DO,
      }),
      task({ id: "open", scheduledFor: "2026-07-01" }),
    ];

    expect(
      selectBacklogTasks(tasks, weekDays(monday)).map((t) => t.id),
    ).toEqual(["open"]);
  });

  it("spans a month boundary within the week", () => {
    // The week straddles July/August, so a naive month comparison would
    // mis-scope 2026-08-01 (a Saturday inside the week).
    const tasks = [task({ id: "sat", scheduledFor: "2026-08-01" })];

    expect(selectBacklogTasks(tasks, weekDays(monday))).toEqual([]);
  });
});

describe("selectBacklogTasks", () => {
  it("excludes tasks scheduled for the given date", () => {
    const tasks = [
      task({ id: "1", scheduledFor: "2026-07-16" }),
      task({ id: "2", scheduledFor: "2026-07-17" }),
    ];

    expect(selectBacklogTasks(tasks, [date]).map((t) => t.id)).toEqual(["2"]);
  });

  it("includes unscheduled incomplete tasks", () => {
    const tasks = [task({ id: "1", scheduledFor: null })];

    expect(selectBacklogTasks(tasks, [date]).map((t) => t.id)).toEqual(["1"]);
  });

  it("excludes completed and won't-do tasks", () => {
    const tasks = [
      task({ id: "1", scheduledFor: "2026-07-17", status: ETaskStatus.DONE }),
      task({
        id: "2",
        scheduledFor: "2026-07-17",
        status: ETaskStatus.WONT_DO,
      }),
      task({
        id: "3",
        scheduledFor: "2026-07-17",
        status: ETaskStatus.IN_PROGRESS,
      }),
    ];

    expect(selectBacklogTasks(tasks, [date]).map((t) => t.id)).toEqual(["3"]);
  });
});

describe("filterTasks", () => {
  const today = Temporal.PlainDate.from("2026-07-16");

  it("returns every task unchanged for 'none'", () => {
    const tasks = [task({ id: "1" }), task({ id: "2" })];

    expect(filterTasks(tasks, "none", today)).toEqual(tasks);
  });

  it("'overdue' matches a dueOn strictly before today", () => {
    const tasks = [
      task({ id: "1", dueOn: "2026-07-15" }),
      task({ id: "2", dueOn: "2026-07-16" }),
      task({ id: "3", dueOn: null }),
    ];

    expect(filterTasks(tasks, "overdue", today).map((t) => t.id)).toEqual([
      "1",
    ]);
  });

  it("'dueSoon' matches a dueOn within the next 13 days, inclusive of today", () => {
    const tasks = [
      task({ id: "1", dueOn: "2026-07-15" }),
      task({ id: "2", dueOn: "2026-07-16" }),
      task({ id: "3", dueOn: "2026-07-29" }),
      task({ id: "4", dueOn: "2026-07-30" }),
    ];

    expect(filterTasks(tasks, "dueSoon", today).map((t) => t.id)).toEqual([
      "2",
      "3",
    ]);
  });

  it("'leftBehind' matches a scheduledFor strictly before today", () => {
    const tasks = [
      task({ id: "1", scheduledFor: "2026-07-15" }),
      task({ id: "2", scheduledFor: "2026-07-16" }),
      task({ id: "3", scheduledFor: null }),
    ];

    expect(filterTasks(tasks, "leftBehind", today).map((t) => t.id)).toEqual([
      "1",
    ]);
  });

  it("'unscheduled' matches a null scheduledFor", () => {
    const tasks = [
      task({ id: "1", scheduledFor: null }),
      task({ id: "2", scheduledFor: "2026-07-16" }),
    ];

    expect(filterTasks(tasks, "unscheduled", today).map((t) => t.id)).toEqual([
      "1",
    ]);
  });
});

describe("backlogAttentionFilter", () => {
  const today = Temporal.PlainDate.from("2026-07-16");

  it("returns 'overdue' when an incomplete task is overdue", () => {
    expect(backlogAttentionFilter([task({ dueOn: "2026-07-15" })], today)).toBe(
      "overdue",
    );
  });

  it("returns 'leftBehind' when an incomplete task is only left behind", () => {
    expect(
      backlogAttentionFilter([task({ scheduledFor: "2026-07-15" })], today),
    ).toBe("leftBehind");
  });

  it("prioritizes 'overdue' when both overdue and left-behind tasks exist", () => {
    const tasks = [
      task({ id: "1", dueOn: "2026-07-15" }),
      task({ id: "2", scheduledFor: "2026-07-10" }),
    ];

    expect(backlogAttentionFilter(tasks, today)).toBe("overdue");
  });

  it("prioritizes 'overdue' even when a left-behind task comes first", () => {
    const tasks = [
      task({ id: "1", scheduledFor: "2026-07-10" }),
      task({ id: "2", dueOn: "2026-07-15" }),
    ];

    expect(backlogAttentionFilter(tasks, today)).toBe("overdue");
  });

  it("returns null when nothing is overdue or left behind", () => {
    const tasks = [
      task({ id: "1", dueOn: "2026-07-16" }), // due today, not overdue
      task({ id: "2", scheduledFor: "2026-07-16" }), // scheduled today
      task({ id: "3", dueOn: "2026-07-20", scheduledFor: "2026-07-20" }),
      task({ id: "4", dueOn: null, scheduledFor: null }),
    ];

    expect(backlogAttentionFilter(tasks, today)).toBeNull();
  });

  it("ignores completed tasks that are past due or left behind", () => {
    const tasks = [
      task({ id: "1", dueOn: "2026-07-15", status: ETaskStatus.DONE }),
      task({
        id: "2",
        scheduledFor: "2026-07-15",
        status: ETaskStatus.WONT_DO,
      }),
    ];

    expect(backlogAttentionFilter(tasks, today)).toBeNull();
  });

  it("uses a strict boundary — due today / scheduled today does not count", () => {
    const tasks = [
      task({ id: "1", dueOn: "2026-07-16" }),
      task({ id: "2", scheduledFor: "2026-07-16" }),
    ];

    expect(backlogAttentionFilter(tasks, today)).toBeNull();
  });

  it("returns null for an empty task list", () => {
    expect(backlogAttentionFilter([], today)).toBeNull();
  });
});

describe("backlogCounts", () => {
  const today = Temporal.PlainDate.from("2026-07-16");

  it("counts each bucket separately", () => {
    const tasks = [
      task({ id: "1", scheduledFor: "2026-07-10" }),
      task({ id: "2", scheduledFor: "2026-07-15" }),
      task({ id: "3", dueOn: "2026-07-15" }),
      task({ id: "4", dueOn: "2026-07-20" }),
    ];

    expect(backlogCounts(tasks, today)).toEqual({
      leftBehind: 2,
      overdue: 1,
      dueSoon: 1,
    });
  });

  it("counts a task in every bucket it belongs to", () => {
    // Each figure answers for its own preset, not a share of one total — a task
    // both left behind and overdue shows under either preset the reader picks.
    const tasks = [task({ scheduledFor: "2026-07-10", dueOn: "2026-07-12" })];

    expect(backlogCounts(tasks, today)).toEqual({
      leftBehind: 1,
      overdue: 1,
      dueSoon: 0,
    });
  });

  it("uses a strict boundary — due today / scheduled today is not overdue or left behind", () => {
    const tasks = [
      task({ id: "1", scheduledFor: "2026-07-16" }),
      task({ id: "2", dueOn: "2026-07-16" }),
    ];

    expect(backlogCounts(tasks, today)).toEqual({
      leftBehind: 0,
      // Due today is not yet overdue, but it *is* due soon — the window opens
      // on today.
      overdue: 0,
      dueSoon: 1,
    });
  });

  it("counts the due-soon window inclusive at both ends", () => {
    const tasks = [
      task({ id: "1", dueOn: "2026-07-16" }), // today
      task({ id: "2", dueOn: "2026-07-29" }), // today + 13
      task({ id: "3", dueOn: "2026-07-30" }), // today + 14, outside
    ];

    expect(backlogCounts(tasks, today).dueSoon).toBe(2);
  });

  it("is all zeroes for an empty backlog", () => {
    expect(backlogCounts([], today)).toEqual({
      leftBehind: 0,
      overdue: 0,
      dueSoon: 0,
    });
  });

  it("counts nothing for a backlog of undated, unscheduled tasks", () => {
    // The step hides its list entirely on all-zero counts, so this is the case
    // where a non-empty backlog still reads as all clear (DEX-141).
    const tasks = [task({ id: "1" }), task({ id: "2" })];

    expect(backlogCounts(tasks, today)).toEqual({
      leftBehind: 0,
      overdue: 0,
      dueSoon: 0,
    });
  });
});

describe("filterMenuCounts", () => {
  const today = Temporal.PlainDate.from("2026-07-16");

  it("counts every preset the menu shows, including Unscheduled", () => {
    const tasks = [
      task({ id: "1", scheduledFor: "2026-07-10" }), // leftBehind
      task({ id: "2", dueOn: "2026-07-15", scheduledFor: "2026-07-16" }), // overdue
      task({ id: "3", dueOn: "2026-07-20", scheduledFor: "2026-07-16" }), // dueSoon
      task({ id: "4" }), // unscheduled
      task({ id: "5", scheduledFor: "2026-07-16" }), // today: in no bucket
    ];

    expect(filterMenuCounts(tasks, today)).toEqual({
      overdue: 1,
      dueSoon: 1,
      leftBehind: 1,
      unscheduled: 1,
    });
  });

  it("counts a task in every bucket it belongs to", () => {
    const tasks = [task({ scheduledFor: "2026-07-10", dueOn: "2026-07-12" })];

    expect(filterMenuCounts(tasks, today)).toEqual({
      overdue: 1,
      dueSoon: 0,
      leftBehind: 1,
      unscheduled: 0,
    });
  });

  it("is all zeroes for an empty backlog", () => {
    expect(filterMenuCounts([], today)).toEqual({
      overdue: 0,
      dueSoon: 0,
      leftBehind: 0,
      unscheduled: 0,
    });
  });
});

describe("defaultBacklogFilter", () => {
  it("prefers left behind over everything else", () => {
    expect(
      defaultBacklogFilter({ leftBehind: 1, overdue: 4, dueSoon: 9 }),
    ).toBe("leftBehind");
  });

  it("falls to overdue when nothing is left behind", () => {
    expect(
      defaultBacklogFilter({ leftBehind: 0, overdue: 2, dueSoon: 9 }),
    ).toBe("overdue");
  });

  it("falls to due soon when nothing is left behind or overdue", () => {
    expect(
      defaultBacklogFilter({ leftBehind: 0, overdue: 0, dueSoon: 3 }),
    ).toBe("dueSoon");
  });

  it("returns 'none' when nothing needs attention", () => {
    expect(
      defaultBacklogFilter({ leftBehind: 0, overdue: 0, dueSoon: 0 }),
    ).toBe("none");
  });

  it("differs from backlogAttentionFilter's order", () => {
    const tasks = [
      task({ id: "1", scheduledFor: "2026-07-10" }),
      task({ id: "2", dueOn: "2026-07-15" }),
    ];
    const today = Temporal.PlainDate.from("2026-07-16");

    expect(defaultBacklogFilter(backlogCounts(tasks, today))).toBe(
      "leftBehind",
    );
    expect(backlogAttentionFilter(tasks, today)).toBe("overdue");
  });
});

describe("nextBacklogFilter", () => {
  // Emptiness is the only thing allowed to move the filter: a bucket that still
  // has tasks in it is where the reader is working.
  it("keeps a preset that still has tasks", () => {
    expect(
      nextBacklogFilter("leftBehind", {
        leftBehind: 1,
        overdue: 9,
        dueSoon: 9,
      }),
    ).toBe("leftBehind");
  });

  it("moves on once the reader's bucket is empty", () => {
    expect(
      nextBacklogFilter("leftBehind", {
        leftBehind: 0,
        overdue: 3,
        dueSoon: 0,
      }),
    ).toBe("overdue");
  });

  it("follows the hero's order rather than the next one along", () => {
    // Due Soon emptied, but Left Behind has tasks — it reads first, so it wins.
    expect(
      nextBacklogFilter("dueSoon", { leftBehind: 2, overdue: 1, dueSoon: 0 }),
    ).toBe("leftBehind");
  });

  // The step drops the drawer entirely at that point, so the value is moot —
  // but it must not be a preset that would show a stale list on the way out.
  it("returns 'none' when every bucket is empty", () => {
    expect(
      nextBacklogFilter("overdue", { leftBehind: 0, overdue: 0, dueSoon: 0 }),
    ).toBe("none");
  });

  // A detour the reader chose deliberately; the step has no opinion about it.
  it.each(["unscheduled", "none"] as const)(
    "leaves %s alone even when the hero's buckets have tasks",
    (current) => {
      expect(
        nextBacklogFilter(current, { leftBehind: 4, overdue: 0, dueSoon: 0 }),
      ).toBe(current);
    },
  );
});
