import { assert, assertEquals } from "@std/assert";

import { ETaskPriority } from "@src/utils/taskPriority.ts";
import { ETaskStatus, isCompletionStatus } from "@src/utils/taskStatus.ts";

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
    assert(ETaskPriority[template.priority] !== undefined);
  }
});

Deno.test("tasks have valid enums and title length", () => {
  for (const task of data.tasks) {
    // Both checked against the enum's reverse mapping rather than a
    // hand-written bound, so a member added to either enum widens this
    // automatically.
    assert(
      ETaskPriority[task.priority] !== undefined,
      `${task.title} priority`,
    );
    assert(ETaskStatus[task.status] !== undefined, `${task.title} status`);
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

Deno.test("subtasks are well-formed and uniquely keyed within their array", () => {
  for (const task of data.tasks) {
    if (!task.subtasks) continue;
    const ids = new Set<string>();
    for (const subtask of task.subtasks) {
      assert(subtask.id.length > 0, `${task.title} subtask id`);
      assert(!ids.has(subtask.id), `${task.title} duplicate subtask id`);
      ids.add(subtask.id);
      assert(
        subtask.title.length > 0 && subtask.title.length <= 100,
        `${task.title} subtask title length`,
      );
      assert(
        typeof subtask.done === "boolean",
        `${task.title} subtask done`,
      );
    }
  }

  for (const template of data.templates) {
    if (!template.subtasks) continue;
    const ids = new Set<string>();
    for (const subtask of template.subtasks) {
      // Template subtasks are a blueprint: id + title, no `done` field at all.
      assert(!("done" in subtask), `${template.key} template subtask done`);
      assert(!ids.has(subtask.id), `${template.key} duplicate subtask id`);
      ids.add(subtask.id);
      assert(
        subtask.title.length > 0 && subtask.title.length <= 100,
        `${template.key} subtask title length`,
      );
    }
  }
});

Deno.test("demo showcases subtask states for DEX-70", () => {
  const withSubtasks = data.tasks.filter((t) => (t.subtasks?.length ?? 0) > 0);
  assert(withSubtasks.length >= 2, "expected several tasks with checklists");

  // A checklist mid-flight — some items checked off, some still open — is the
  // state the completion sweep and the in-card rendering are most worth showing.
  const hasPartial = withSubtasks.some(
    (t) => t.subtasks!.some((s) => s.done) && t.subtasks!.some((s) => !s.done),
  );
  assert(hasPartial, "expected a partially-completed checklist");

  const templateWithSubtasks = data.templates.find(
    (t) => (t.subtasks?.length ?? 0) > 0,
  );
  assert(templateWithSubtasks, "expected a repeat template with a checklist");
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

// Uses the app's own `isCompletionStatus`, not a local copy of it: a task in any
// terminal status is closed out, so it can't be what makes the demo show an
// overdue or left-behind card — the app filters those out of the backlog.
Deno.test("demo showcases the states screenshots depend on", () => {
  const hasOverdue = data.tasks.some(
    (t) =>
      !isCompletionStatus(t.status) && t.dueOnOffset !== null &&
      t.dueOnOffset < 0,
  );
  const hasLeftBehind = data.tasks.some(
    (t) =>
      !isCompletionStatus(t.status) &&
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

  // The task drawer is one of the App Store screenshots, and a backlog holding
  // one or two rows photographs as an empty feature rather than a place work
  // waits. Spread across lists, so the drawer's grouping has something to show.
  const unscheduled = data.tasks.filter((t) => t.scheduledForOffset === null);
  assert(
    unscheduled.length >= 5,
    `expected at least 5 unscheduled tasks so the backlog screenshot reads as full, got ${unscheduled.length}`,
  );
  assert(
    new Set(unscheduled.map((t) => t.listKey)).size >= 3,
    "expected the unscheduled tasks to span at least 3 lists",
  );

  const priorities = new Set(data.tasks.map((t) => t.priority));
  assertEquals(
    priorities.size,
    5,
    "expected all five priority levels represented",
  );
});

Deno.test("journal prompts pair a prompt with a response", () => {
  for (const journal of data.journals) {
    assert(
      journal.prompts.length > 0,
      `journal ${journal.dateOffset} has no prompts`,
    );
    for (const { prompt, response, period } of journal.prompts) {
      assert(
        prompt.length > 0,
        `journal ${journal.dateOffset} has a nameless prompt`,
      );
      // Today's evening prompts are the one deliberate blank — that ritual has
      // not happened yet, and it shows the step with a field still to fill.
      const blankByDesign = journal.dateOffset === 0 && period === "pm";
      assert(
        blankByDesign ? response.length === 0 : response.length > 0,
        `journal ${journal.dateOffset} prompt "${prompt}" (${period}) has the wrong answered state`,
      );
    }
  }
});

// Both rituals need prompts of their own or the Journal step drops out of one
// of them entirely (DEX-151) — and the screenshots walk both.
Deno.test("journal prompts are seeded for both rituals", () => {
  const periodsAsked = new Set(
    data.preferences.templatePrompts.map((entry) => entry.period),
  );
  assertEquals(
    periodsAsked,
    new Set(["am", "pm"]),
    "expected the template to ask something in each ritual",
  );

  // Ids key the settings editor's rows, so a repeat would hand one row's input
  // state to another.
  const ids = data.preferences.templatePrompts.map((entry) => entry.id);
  assertEquals(
    new Set(ids).size,
    ids.length,
    "expected every template prompt to have a distinct id",
  );

  // Each day's entries carry the period they were seeded with, so the two
  // rituals can each render their own half of a day the demo already answered.
  for (const journal of data.journals) {
    const periods = new Set(journal.prompts.map((entry) => entry.period));
    assertEquals(
      periods,
      new Set(["am", "pm"]),
      `journal ${journal.dateOffset} should hold both rituals' prompts`,
    );
  }
});

Deno.test("notes carry markdown content", () => {
  assert(data.notes.length > 0, "expected seeded notes");
  for (const note of data.notes) {
    assert(
      note.content.trim().length > 0,
      `note ${note.dateOffset} has no content`,
    );
  }
});

Deno.test("addDaysIso shifts dates in UTC without drift", () => {
  assertEquals(addDaysIso("2026-07-18", 0), "2026-07-18");
  assertEquals(addDaysIso("2026-07-18", 3), "2026-07-21");
  assertEquals(addDaysIso("2026-07-18", -2), "2026-07-16");
  assertEquals(addDaysIso("2026-07-31", 1), "2026-08-01"); // month rollover
  assertEquals(addDaysIso("2026-01-01", -1), "2025-12-31"); // year rollover
});
