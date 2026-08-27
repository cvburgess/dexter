import { Temporal } from "@js-temporal/polyfill";

import { TDailyHabit, THabit } from "@/api/habits";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { EThemeMode } from "@/api/preferences";
import { resolveTheme, themes } from "@/utils/theme";

import {
  buildHabitWidgetSnapshot,
  buildWidgetSnapshot,
  parsePendingHabitSteps,
  pendingHabitStepsKey,
  WIDGET_DAY_COUNT,
  WIDGET_HABITS_PER_DAY,
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
    // `resolveTheme` already does this; the point is the widget inherits it
    // and stops following the OS, having no other way to learn `themeMode`.
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
      [
        light.background,
        light.text,
        light.primary,
        light.primaryContent,
        ...light.priority,
      ].every((color) => /^#[0-9a-f]{6}$/i.test(color)),
    ).toBe(true);
  });
});

// `today` is a Thursday (ISO weekday 4); the window runs Thu-Fri-Sat-Sun, 4-7.
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

const habit = (overrides: Partial<THabit> = {}): THabit => ({
  id: "habit-1",
  daysActive: ALL_DAYS,
  emoji: "💧",
  isArchived: false,
  isPaused: false,
  steps: 8,
  title: "Drink water",
  ...overrides,
});

const dailyHabit = (overrides: Partial<TDailyHabit> = {}): TDailyHabit => ({
  date: "2026-07-16",
  habitId: "habit-1",
  habits: habit(),
  percentComplete: 25,
  steps: 8,
  stepsComplete: 2,
  ...overrides,
});

const buildHabits = (habits: THabit[], dailyHabits: TDailyHabit[] = []) =>
  buildHabitWidgetSnapshot(habits, dailyHabits, today, palettes);

describe("buildHabitWidgetSnapshot", () => {
  it("carries today and the next three days, in order", () => {
    const { days } = buildHabits([habit()]);

    expect(days).toHaveLength(WIDGET_DAY_COUNT);
    expect(days.map((day) => day.date)).toEqual([
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
      "2026-07-19",
    ]);
  });

  it("keeps only habits scheduled for each day's own weekday", () => {
    // Thursday is 4, Saturday 6 — so the weekday habit lands on days 0 and 1
    // and the weekend one on days 2 and 3.
    const { days } = buildHabits([
      habit({ id: "weekday", daysActive: [1, 2, 3, 4, 5] }),
      habit({ id: "weekend", daysActive: [6, 7] }),
    ]);

    expect(days.map((day) => day.habits.map((h) => h.id))).toEqual([
      ["weekday"],
      ["weekday"],
      ["weekend"],
      ["weekend"],
    ]);
  });

  it("drops paused and archived habits from every day", () => {
    const { days } = buildHabits([
      habit({ id: "active" }),
      habit({ id: "paused", isPaused: true }),
      habit({ id: "archived", isArchived: true }),
    ]);

    // A habit edit doesn't invalidate the dailyHabits cache, so the filter
    // has to be here too, the way `HabitTracker` applies it defensively.
    days.forEach((day) => {
      expect(day.habits.map((h) => h.id)).toEqual(["active"]);
    });
  });

  it("fills today's rings from the daily rows and leaves later days empty", () => {
    const { days } = buildHabits(
      [habit({ id: "habit-1" })],
      [dailyHabit({ habitId: "habit-1", stepsComplete: 5 })],
    );

    expect(days[0].habits[0]).toEqual({
      id: "habit-1",
      emoji: "💧",
      title: "Drink water",
      steps: 8,
      stepsComplete: 5,
    });
    expect(days.slice(1).map((day) => day.habits[0].stepsComplete)).toEqual([
      0, 0, 0,
    ]);
  });

  it("still lists a habit whose daily row does not exist yet", () => {
    // Rows are bootstrapped by an effect in `HabitTracker`; driving the widget
    // off `dailyHabits` would leave the home screen empty on those mornings.
    const { days } = buildHabits([habit({ id: "habit-1" })], []);

    expect(days[0].habits[0].stepsComplete).toBe(0);
    expect(days[0].habits[0].steps).toBe(8);
  });

  it("takes `steps` from the daily row when one exists", () => {
    // The trigger rewrites the row's `steps` on a same-day edit, so the row is
    // what the app is showing a fraction of.
    const { days } = buildHabits(
      [habit({ id: "habit-1", steps: 8 })],
      [dailyHabit({ habitId: "habit-1", steps: 3, stepsComplete: 3 })],
    );

    expect(days[0].habits[0].steps).toBe(3);
  });

  it("ignores a daily row belonging to another day", () => {
    const { days } = buildHabits(
      [habit({ id: "habit-1" })],
      [dailyHabit({ date: "2026-07-15", stepsComplete: 7 })],
    );

    expect(days[0].habits[0].stepsComplete).toBe(0);
  });

  it("caps each day at WIDGET_HABITS_PER_DAY, in habit id order", () => {
    const habits = Array.from({ length: WIDGET_HABITS_PER_DAY + 3 }, (_, i) =>
      // Zero-padded so lexical order is numeric order.
      habit({ id: `habit-${String(i).padStart(2, "0")}` }),
    );

    const { days } = buildHabits(habits.toReversed());

    expect(days[0].habits).toHaveLength(WIDGET_HABITS_PER_DAY);
    expect(days[0].habits.map((h) => h.id)).toEqual(
      habits.slice(0, WIDGET_HABITS_PER_DAY).map((h) => h.id),
    );
  });

  it("sends both palettes, with the checkmark ink Swift needs", () => {
    const { light, dark } = buildHabits([]);

    expect(light.primaryContent).toBe(themes.dexter.colors.primaryContent);
    expect(dark.primaryContent).toBe(themes.dark.colors.primaryContent);
  });
});

describe("parsePendingHabitSteps", () => {
  const key = pendingHabitStepsKey("2026-07-16", "habit-1");

  it("reads the queue the extension wrote", () => {
    expect(parsePendingHabitSteps(JSON.stringify({ [key]: 3 }))).toEqual({
      [key]: 3,
    });
  });

  it("is empty for nothing, for junk, and for the wrong shape", () => {
    expect(parsePendingHabitSteps(null)).toEqual({});
    expect(parsePendingHabitSteps("")).toEqual({});
    expect(parsePendingHabitSteps("{ not json")).toEqual({});
    expect(parsePendingHabitSteps("[1,2]")).toEqual({});
    expect(parsePendingHabitSteps("null")).toEqual({});
  });

  it("drops unreadable entries without losing the readable ones", () => {
    // A half-finished write from the extension can leave one entry malformed
    // — rejecting the whole object would cost every tap since last open.
    const raw = JSON.stringify({
      [key]: 3,
      "no-separator": 1,
      [pendingHabitStepsKey("2026-07-17", "habit-2")]: "4",
      [pendingHabitStepsKey("2026-07-18", "habit-3")]: -1,
      [pendingHabitStepsKey("2026-07-19", "habit-4")]: 1.5,
    });

    expect(parsePendingHabitSteps(raw)).toEqual({ [key]: 3 });
  });
});
