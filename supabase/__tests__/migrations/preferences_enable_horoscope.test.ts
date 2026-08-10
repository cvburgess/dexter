import { assert, assertStringIncludes } from "@std/assert";

import { statements } from "./sqlStatements.ts";

// DEX-142: static guards over the horoscope preference migration.

const migrationUrl = new URL(
  "../../migrations/20260810213641_add_preferences_enable_horoscope.sql",
  import.meta.url,
);
const sql = (await Deno.readTextFile(migrationUrl)).toLowerCase();

Deno.test("enable_horoscope is added to preferences", () => {
  const statement = statements(sql).find((s) =>
    s.includes("add column") && s.includes("enable_horoscope")
  );

  assert(statement, "enable_horoscope column must be added");
  assertStringIncludes(statement, "public.preferences");
  // NOT NULL DEFAULT TRUE matters twice over: the app reads this as a plain
  // boolean with no null guard, and `true` is what keeps the Horoscope step
  // where it already is for every user who had it before this shipped.
  assertStringIncludes(statement, "not null");
  assertStringIncludes(statement, "default true");
});

Deno.test("the migration is idempotent and touches nothing else", () => {
  const all = statements(sql);

  assertStringIncludes(all[0], "add column if not exists");
  assert(
    all.length === 1,
    `expected a single statement, found ${all.length}`,
  );
});
