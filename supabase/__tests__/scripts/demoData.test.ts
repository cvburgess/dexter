import { assert, assertEquals } from "@std/assert";

import {
  addDaysIso,
  buildDemoData,
  DEMO_STATUS,
} from "../../scripts/demoData.ts";

// The demo seed runs with the service role (no DB validation in CI), so these
// tests guard the curated data the same way the migration tests guard SQL:
// assert the shape is valid and self-consistent before it ever hits Postgres.

const data = buildDemoData();

const CRON_REGEX = /^0 0 (\S+) (\S+) (\S+)$/;

Deno.test("lists and habits carry a non-empty emoji (NOT NULL columns)", () => {
  for (const list of data.lists) {
    assert(list.emoji.length > 0, `list ${list.key} missing emoji`);
  }
  for (const habit of data.habits) {
    assert(habit.emoji.length > 0, `habit ${habit.key} missing emoji`);
  }
});

Deno.test("habits have valid steps and ISO weekdays", () => {
  for (const habit of data.habits) {
    assert(habit.steps >= 1, `habit ${habit.key} needs steps >= 1`);
    assert(habit.daysActive.length > 0, `habit ${habit.key} needs active days`);
    for (const day of habit.daysActive) {
      assert(day >= 1 && day <= 7, `habit ${habit.key} weekday out of range`);
    }
  }
});

Deno.test("templates use valid midnight cron schedules", () => {
  for (const template of data.templates) {
    assert(
      CRON_REGEX.test(template.schedule),
      `template ${template.key} bad schedule: ${template.schedule}`,
    );
    assert(template.priority >= 0 && template.priority <= 4);
  }
});

Deno.test("tasks have valid enums and title length", () => {
  for (const task of data.tasks) {
    assert(task.priority >= 0 && task.priority <= 4, `${task.title} priority`);
    assert(task.status >= 0 && task.status <= 3, `${task.title} status`);
    assert(
      task.title.length > 0 && task.title.length <= 100,
      `${task.title} length`,
    );
    if (task.alarmTime !== undefined) {
      assert(
        /^\d{2}:\d{2}$/.test(task.alarmTime),
        `${task.title} alarm format`,
      );
    }
  }
});

Deno.test("daily habits never exceed their step count", () => {
  for (const entry of data.dailyHabits) {
    assert(entry.steps >= 1, `${entry.habitKey} steps`);
    assert(
      entry.stepsComplete >= 0 && entry.stepsComplete <= entry.steps,
      `${entry.habitKey} stepsComplete out of range`,
    );
  }
});

Deno.test("every foreign key reference resolves to a defined entity", () => {
  const listKeys = new Set(data.lists.map((l) => l.key));
  const goalKeys = new Set(data.goals.map((g) => g.key));
  const habitKeys = new Set(data.habits.map((h) => h.key));
  const templateKeys = new Set(data.templates.map((t) => t.key));

  for (const template of data.templates) {
    if (template.listKey) assert(listKeys.has(template.listKey), template.key);
    if (template.goalKey) assert(goalKeys.has(template.goalKey), template.key);
  }
  for (const task of data.tasks) {
    if (task.listKey) assert(listKeys.has(task.listKey), task.title);
    if (task.goalKey) assert(goalKeys.has(task.goalKey), task.title);
    if (task.templateKey) {
      assert(templateKeys.has(task.templateKey), task.title);
    }
  }
  for (const entry of data.dailyHabits) {
    assert(habitKeys.has(entry.habitKey), entry.habitKey);
  }
});

Deno.test("demo showcases the states screenshots depend on", () => {
  const hasOverdue = data.tasks.some(
    (t) =>
      t.status !== DEMO_STATUS.DONE &&
      t.status !== DEMO_STATUS.WONT_DO &&
      t.dueOnOffset !== null &&
      t.dueOnOffset < 0,
  );
  const hasLeftBehind = data.tasks.some(
    (t) =>
      t.status !== DEMO_STATUS.DONE &&
      t.status !== DEMO_STATUS.WONT_DO &&
      t.scheduledForOffset !== null &&
      t.scheduledForOffset < 0,
  );
  const hasUnscheduled = data.tasks.some((t) => t.scheduledForOffset === null);
  const hasDone = data.tasks.some((t) => t.status === DEMO_STATUS.DONE);
  const hasWontDo = data.tasks.some((t) => t.status === DEMO_STATUS.WONT_DO);
  const hasAlarm = data.tasks.some((t) => t.alarmTime !== undefined);

  assert(hasOverdue, "expected an overdue task");
  assert(hasLeftBehind, "expected a left-behind task");
  assert(hasUnscheduled, "expected an unscheduled backlog task");
  assert(hasDone, "expected a completed task");
  assert(hasWontDo, "expected a won't-do task");
  assert(hasAlarm, "expected a task with an alarm");

  const priorities = new Set(data.tasks.map((t) => t.priority));
  assertEquals(
    priorities.size,
    5,
    "expected all five priority levels represented",
  );
});

Deno.test("journal prompts pair a prompt with a response", () => {
  for (const day of data.days) {
    assert(day.prompts.length > 0, `day ${day.dateOffset} has no prompts`);
    for (const { prompt, response } of day.prompts) {
      assert(prompt.length > 0 && response.length > 0);
    }
  }
});

Deno.test("addDaysIso shifts dates in UTC without drift", () => {
  assertEquals(addDaysIso("2026-07-18", 0), "2026-07-18");
  assertEquals(addDaysIso("2026-07-18", 3), "2026-07-21");
  assertEquals(addDaysIso("2026-07-18", -2), "2026-07-16");
  assertEquals(addDaysIso("2026-07-31", 1), "2026-08-01"); // month rollover
  assertEquals(addDaysIso("2026-01-01", -1), "2025-12-31"); // year rollover
});
