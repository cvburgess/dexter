import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import { statements } from "./sqlStatements.ts";

// DEX-128: static guards over the sun sign migration.

const migrationUrl = new URL(
  "../../migrations/20260810012904_add_preferences_sun_sign.sql",
  import.meta.url,
);
const sql = (await Deno.readTextFile(migrationUrl)).toLowerCase();

Deno.test("sun_sign is added to preferences", () => {
  const statement = statements(sql).find((s) =>
    s.includes("add column") && s.includes("sun_sign")
  );

  assert(statement, "sun_sign column must be added");
  assertStringIncludes(statement, "public.preferences");
  // The shared enum, not a second spelling of the same twelve values: this
  // column exists to look up `horoscopes`, which is keyed by that very type.
  assertStringIncludes(statement, "public.sun_sign");
});

Deno.test("sun_sign is nullable with no default", () => {
  const statement = statements(sql).find((s) =>
    s.includes("add column") && s.includes("sun_sign")
  )!;

  // The inverse of the alarm_sound migration, and deliberately so. "Not set" is
  // a state the Horoscope ritual step renders (it prompts for a sign rather
  // than showing one), so NULL has to be reachable — and there is no sign that
  // would be correct to default a new user to.
  assert(
    !statement.includes("not null"),
    "sun_sign must stay nullable — the UI renders an unset sign",
  );
  assert(
    !statement.includes("default"),
    "sun_sign must have no default — guessing a sign shows the wrong horoscope",
  );
});

Deno.test("the migration is idempotent and touches nothing else", () => {
  const all = statements(sql);

  assertStringIncludes(all[0], "add column if not exists");
  assertEquals(
    all.length,
    1,
    `expected a single statement, found ${all.length}`,
  );
});
