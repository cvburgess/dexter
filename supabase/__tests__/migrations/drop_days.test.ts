import { assert, assertStringIncludes } from "@std/assert";

import { statements } from "./sqlStatements.ts";

// DEX-90: static guards over dropping the deprecated `days` table.
//
// Backend CI runs `deno test` with no Postgres, so these assert over the
// migration SQL text. Which text matters per assertion: the header carries a
// rollback block that recreates `days`, so anything about what the migration
// *executes* goes through `statements()` (comments stripped) or the prose would
// satisfy it on its own. The rollback assertion is the deliberate exception.

const migrationUrl = new URL(
  "../../migrations/20260727035544_drop_days.sql",
  import.meta.url,
);
const sql = (await Deno.readTextFile(migrationUrl)).toLowerCase();

Deno.test("the migration drops public.days, idempotently", () => {
  const all = statements(sql);

  assert(all.length === 1, `expected a single statement, found ${all.length}`);
  assertStringIncludes(all[0], "drop table if exists public.days");
});

Deno.test("publication membership is left to the drop", () => {
  // Dropping a table removes it from every publication, so `days` leaves
  // `supabase_realtime` on its own. An explicit `alter publication ... drop
  // table` would also break `supabase db reset` re-runs: unlike the drop, it
  // has no `if exists` form and errors on the already-missing relation.
  assert(
    !statements(sql).some((s) => s.includes("alter publication")),
    "the drop removes days from supabase_realtime; do not do it explicitly",
  );
});

Deno.test("a rollback path is documented", () => {
  // Repo convention for destructive migrations. It has to recreate `days` *and*
  // backfill from notes/journals — after this runs, `days` is no longer the
  // copy of record that DEX-51's own rollback note assumed it would be.
  assertStringIncludes(sql, "-- rollback:");
  assertStringIncludes(sql, "create table if not exists public.days");
  assertStringIncludes(sql, "insert into public.days");
});
