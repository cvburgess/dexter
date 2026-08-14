import { Temporal } from "@js-temporal/polyfill";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { EThemeMode } from "@/api/preferences";
import { resolveTheme, themes } from "@/utils/theme";

import {
  buildWidgetSnapshot,
  WIDGET_DAY_COUNT,
  WIDGET_TASKS_PER_DAY,
} from "../widgets.shared";

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

const today = Temporal.PlainDate.from("2026-07-16");

// The real palettes, so a field renamed in `theme.ts` fails here rather than
// silently shipping `undefined` to Swift.
const palettes = {
  light: themes.dexter.colors,
  dark: themes.dark.colors,
};

const build = (tasks: TTask[]) => buildWidgetSnapshot(tasks, today, palettes);

describe("buildWidgetSnapshot", () => {
  it("carries today and the next three days, in order", () => {
    const { days } = build([]);

    expect(days).toHaveLength(WIDGET_DAY_COUNT);
    expect(days.map((day) => day.date)).toEqual([
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
      "2026-07-19",
    ]);
  });

  it("keeps only open tasks scheduled inside the window", () => {
    const { days } = build([
      task({ id: "open", scheduledFor: "2026-07-16" }),
      task({
        id: "done",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.DONE,
      }),
      task({
        id: "wont-do",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.WONT_DO,
      }),
      task({
        id: "delegated",
        scheduledFor: "2026-07-16",
        status: ETaskStatus.DELEGATED,
      }),
      task({ id: "unscheduled" }),
      task({ id: "yesterday", scheduledFor: "2026-07-15" }),
      task({ id: "next-week", scheduledFor: "2026-07-23" }),
    ]);

    expect(days[0].tasks.map((entry) => entry.id)).toEqual(["open"]);
    expect(days.slice(1).flatMap((day) => day.tasks)).toEqual([]);
  });

  it("keeps the true open count when the task list is truncated", () => {
    const tasks = Array.from({ length: WIDGET_TASKS_PER_DAY + 3 }, (_, index) =>
      task({ id: `task-${index}`, scheduledFor: "2026-07-16" }),
    );

    const [day] = build(tasks).days;

    // The header count must not quietly become "up to WIDGET_TASKS_PER_DAY".
    expect(day.openCount).toBe(WIDGET_TASKS_PER_DAY + 3);
    expect(day.tasks).toHaveLength(WIDGET_TASKS_PER_DAY);
  });

  it("preserves the order it was given, so the widget matches the app", () => {
    // The canonical fetch already orders by status, then priority, then due
    // date; re-sorting here would put the widget out of step with Today.
    const { days } = build([
      task({ id: "first", scheduledFor: "2026-07-16" }),
      task({
        id: "second",
        scheduledFor: "2026-07-16",
        priority: ETaskPriority.IMPORTANT_AND_URGENT,
      }),
      task({ id: "third", scheduledFor: "2026-07-16" }),
    ]);

    expect(days[0].tasks.map((entry) => entry.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("sends priority as its raw enum index, which is what Swift indexes with", () => {
    const { days, light } = build([
      task({
        scheduledFor: "2026-07-16",
        priority: ETaskPriority.IMPORTANT_AND_URGENT,
      }),
    ]);

    expect(days[0].tasks[0].priority).toBe(0);
    expect(light.priority).toHaveLength(5);
  });

  it("sends the two palettes the OS scheme picks between", () => {
    const { light, dark } = buildWidgetSnapshot([], today, {
      light: resolveTheme(
        {
          themeMode: EThemeMode.SYSTEM,
          lightTheme: "dexter",
          darkTheme: "abyss",
        },
        "light",
      ).colors,
      dark: resolveTheme(
        {
          themeMode: EThemeMode.SYSTEM,
          lightTheme: "dexter",
          darkTheme: "abyss",
        },
        "dark",
      ).colors,
    });

    expect(light.background).toBe(themes.dexter.colors.background);
    expect(dark.background).toBe(themes.abyss.colors.background);
  });

  it("collapses both palettes to one when the user has forced a scheme", () => {
    // `resolveTheme` already does this; the point is that the widget inherits
    // it and correctly stops following the OS, because it has no other way to
    // learn about `themeMode`.
    const forced = {
      themeMode: EThemeMode.LIGHT,
      lightTheme: "light",
      darkTheme: "abyss",
    };

    const { light, dark } = buildWidgetSnapshot([], today, {
      light: resolveTheme(forced, "light").colors,
      dark: resolveTheme(forced, "dark").colors,
    });

    expect(dark).toEqual(light);
    expect(light.background).toBe(themes.light.colors.background);
  });

  it("omits the colors Swift cannot parse", () => {
    // `textSecondary` is `rgba(...)` and `priorityMuted` is blended at module
    // load; both would decode wrong or not at all on the other side.
    const { light } = build([]);

    expect(light).not.toHaveProperty("textSecondary");
    expect(light).not.toHaveProperty("priorityMuted");
    expect(
      [light.background, light.text, light.primary, ...light.priority].every(
        (color) => /^#[0-9a-f]{6}$/i.test(color),
      ),
    ).toBe(true);
  });
});
