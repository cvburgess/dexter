import { Temporal } from "@js-temporal/polyfill";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";

import {
  backlogAttentionFilter,
  filterTasks,
  isCompletionStatus,
  selectBacklogTasks,
  selectTasksForDate,
} from "../taskFilters";

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  title: "Write report",
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.URGENT,
  scheduledFor: null,
  status: ETaskStatus.TODO,
  templateId: null,
  ...overrides,
});

const date = Temporal.PlainDate.from("2026-07-16");

describe("isCompletionStatus", () => {
  it("is true only for DONE and WONT_DO", () => {
    expect(isCompletionStatus(ETaskStatus.DONE)).toBe(true);
    expect(isCompletionStatus(ETaskStatus.WONT_DO)).toBe(true);
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

describe("selectBacklogTasks", () => {
  it("excludes tasks scheduled for the given date", () => {
    const tasks = [
      task({ id: "1", scheduledFor: "2026-07-16" }),
      task({ id: "2", scheduledFor: "2026-07-17" }),
    ];

    expect(selectBacklogTasks(tasks, date).map((t) => t.id)).toEqual(["2"]);
  });

  it("includes unscheduled incomplete tasks", () => {
    const tasks = [task({ id: "1", scheduledFor: null })];

    expect(selectBacklogTasks(tasks, date).map((t) => t.id)).toEqual(["1"]);
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

    expect(selectBacklogTasks(tasks, date).map((t) => t.id)).toEqual(["3"]);
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
