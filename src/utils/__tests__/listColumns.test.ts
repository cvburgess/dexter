import { TList } from "@/api/lists";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";

import { listColumns } from "../listColumns";

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

const list = (id: string, emoji = "📋"): TList => ({
  id,
  emoji,
  title: id,
  isArchived: false,
  createdAt: "2026-01-01T00:00:00Z",
});

const lists = [list("work", "💼"), list("home", "🏠")];

describe("listColumns", () => {
  it("keeps every list in order, empty ones included, with no No List column when all tasks are listed", () => {
    const columns = listColumns([task({ listId: "home" })], lists);

    expect(columns.map((column) => column.listId)).toEqual(["work", "home"]);
    expect(columns[0].tasks).toEqual([]);
    expect(columns[1].tasks.map((t) => t.id)).toEqual(["task-1"]);
  });

  it("leads with No List when an open task has no list", () => {
    const columns = listColumns([task({ listId: null })], lists);

    expect(columns.map((column) => column.listId)).toEqual([
      null,
      "work",
      "home",
    ]);
    expect(columns[0].title).toBe("No List");
  });

  it("puts a task whose list is archived or unknown in No List", () => {
    const columns = listColumns([task({ listId: "archived" })], lists);

    expect(columns[0].listId).toBeNull();
    expect(columns[0].tasks.map((t) => t.id)).toEqual(["task-1"]);
  });

  it("leaves completed tasks out, so a done unlisted task doesn't summon No List", () => {
    const columns = listColumns(
      [
        task({ id: "done", status: ETaskStatus.DONE }),
        task({ id: "wont", listId: "work", status: ETaskStatus.WONT_DO }),
        task({ id: "doing", listId: "work", status: ETaskStatus.IN_PROGRESS }),
      ],
      lists,
    );

    expect(columns.map((column) => column.listId)).toEqual(["work", "home"]);
    expect(columns[0].tasks.map((t) => t.id)).toEqual(["doing"]);
  });
});
