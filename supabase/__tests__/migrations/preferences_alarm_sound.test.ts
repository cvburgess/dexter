import { assert, assertStringIncludes } from "@std/assert";

// DEX-72: static guards over the alarm sound migration.
//
// Like `task_subtasks.test.ts`, backend CI runs `deno test` with no Postgres, so
// these assert over the migration SQL text rather than a live database.

const migrationUrl = new URL(
  "../../migrations/20260726193509_add_preferences_alarm_sound.sql",
  import.meta.url,
);
const sql = (await Deno.readTextFile(migrationUrl)).toLowerCase();

function statements(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

Deno.test("alarm_sound is added to preferences", () => {
  const statement = statements(sql).find((s) =>
    s.includes("add column") && s.includes("alarm_sound")
  );

  assert(statement, "alarm_sound column must be added");
  assertStringIncludes(statement, "public.preferences");
  // NOT NULL DEFAULT 'echos' matters twice over: every read path treats the
  // sound as a plain string without null-guarding, and the default is what makes
  // existing rows ring with Dexter's sound rather than the iOS one.
  assertStringIncludes(statement, "not null");
  assertStringIncludes(statement, "default 'echos'");
});

Deno.test("the migration is idempotent and touches nothing else", () => {
  const all = statements(sql);

  assertStringIncludes(all[0], "add column if not exists");
  assert(
    all.length === 1,
    `expected a single statement, found ${all.length}`,
  );
});
