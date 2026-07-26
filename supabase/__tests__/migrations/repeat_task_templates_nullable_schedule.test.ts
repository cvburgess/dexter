import { assert, assertStringIncludes } from "@std/assert";

import { statements } from "./sqlStatements.ts";

// DEX-65: static guards over the nullable-schedule migration.

const migrationUrl = new URL(
  "../../migrations/20260726215225_repeat_task_templates_nullable_schedule.sql",
  import.meta.url,
);
const sql = (await Deno.readTextFile(migrationUrl)).toLowerCase();

Deno.test("schedule becomes nullable", () => {
  const statement = statements(sql).find((s) =>
    s.includes("drop not null") && s.includes("schedule")
  );

  // A NULL schedule is what marks a row as a reusable task template rather
  // than a repeat task, so the whole feature rests on this one constraint.
  assert(statement, "schedule must drop NOT NULL");
  assertStringIncludes(statement, "public.repeat_task_templates");
});

Deno.test("the daily-cron default is dropped alongside it", () => {
  const statement = statements(sql).find((s) =>
    s.includes("drop default") && s.includes("schedule")
  );

  // Leaving `default '0 0 * * *'` on a now-nullable column would make an
  // omitted schedule silently mean "repeats every day" — the opposite of what
  // a caller creating a template intends.
  assert(statement, "schedule must drop its default");
  assertStringIncludes(statement, "public.repeat_task_templates");
});

Deno.test("the migration touches nothing else", () => {
  const all = statements(sql);

  assert(all.length === 2, `expected two statements, found ${all.length}`);
});
