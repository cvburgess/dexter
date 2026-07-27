import { assert, assertStringIncludes } from "@std/assert";

import { statements, withoutComments } from "./sqlStatements.ts";

// DEX-51: static guards over the notes/journals split.
//
// Backend CI runs `deno test` with no Postgres, so these assert over the
// migration SQL text. They pin the properties the split depends on: the two
// tables' shape and keying, RLS with a constrained UPDATE `with check`, a
// backfill that skips empty `days` columns, and `days` left intact.

const migrationUrl = new URL(
  "../../migrations/20260726215745_split_notes_journals.sql",
  import.meta.url,
);
const raw = await Deno.readTextFile(migrationUrl);
const sql = raw.toLowerCase();
// Comment-free text, for assertions that must not be satisfiable by prose in
// the migration header (this one's is long).
const code = withoutComments(sql);

function createTable(table: string): string {
  const statement = statements(sql).find((s) =>
    s.includes(`create table if not exists public.${table}`)
  );
  assert(statement, `public.${table} must be created`);
  return statement;
}

Deno.test("notes is keyed (user_id, date) with a non-null content column", () => {
  const statement = createTable("notes");

  assertStringIncludes(statement, "content text not null default ''");
  assertStringIncludes(
    statement,
    "created_at timestamptz not null default now()",
  );
  // Leading with user_id means the PK index serves user-scoped lookups (so no
  // separate idx is needed) and keeps user_id in DELETE realtime payloads.
  assertStringIncludes(statement, "primary key (user_id, date)");
  assertStringIncludes(
    statement,
    "references auth.users(id) on delete cascade",
  );
});

Deno.test("journals is keyed (user_id, date) with a non-null prompts array", () => {
  const statement = createTable("journals");

  assertStringIncludes(statement, "prompts jsonb not null default '[]'::jsonb");
  assertStringIncludes(
    statement,
    "created_at timestamptz not null default now()",
  );
  assertStringIncludes(statement, "primary key (user_id, date)");
  assertStringIncludes(
    statement,
    "references auth.users(id) on delete cascade",
  );

  // Every reader treats `prompts` as an array without type-guarding, and jsonb
  // alone permits an object/string/number (same guard as tasks.subtasks).
  const constraint = statements(sql).find((s) =>
    s.includes("add constraint journals_prompts_is_array")
  );
  assert(constraint, "journals.prompts must be constrained to a jsonb array");
  assertStringIncludes(constraint, "jsonb_typeof(prompts) = 'array'");
});

Deno.test("both tables enable RLS with ownership policies for all four operations", () => {
  for (const table of ["notes", "journals"]) {
    assertStringIncludes(
      code,
      `alter table public.${table} enable row level security`,
    );

    for (const operation of ["select", "insert", "update", "delete"]) {
      const policy = statements(sql).find((s) =>
        s.includes(`on "public"."${table}"`) &&
        s.includes(`for ${operation}`)
      );
      assert(policy, `${table} needs a ${operation} policy`);
      assertStringIncludes(policy, 'to "authenticated"');
      assertStringIncludes(policy, "auth.uid");
      assertStringIncludes(policy, "user_id");
    }
  }
});

Deno.test("UPDATE policies constrain WITH CHECK, not just USING", () => {
  for (const table of ["notes", "journals"]) {
    const policy = statements(sql).find((s) =>
      s.includes(`on "public"."${table}"`) && s.includes("for update")
    )!;
    const withCheck = policy.slice(policy.indexOf("with check"));

    // `with check (true)` (the baseline's mistake, fixed in 20260708040856)
    // lets a user reassign user_id to another account.
    assert(
      !withCheck.includes("(true)"),
      `${table} UPDATE policy must not use with check (true)`,
    );
    assertStringIncludes(withCheck, "auth.uid");
    assertStringIncludes(withCheck, "user_id");
  }
});

Deno.test("the backfill copies only non-empty days columns", () => {
  const notesBackfill = statements(sql).find((s) =>
    s.includes("insert into public.notes")
  );
  assert(notesBackfill, "notes must be backfilled from days");
  assertStringIncludes(notesBackfill, "from public.days");
  // Copying blank values too would erase the "never started" vs "started but
  // blank" distinction the notes template chooser reads off `exists`.
  assertStringIncludes(notesBackfill, "notes is not null and notes <> ''");
  assertStringIncludes(notesBackfill, "on conflict (user_id, date) do nothing");

  const journalsBackfill = statements(sql).find((s) =>
    s.includes("insert into public.journals")
  );
  assert(journalsBackfill, "journals must be backfilled from days");
  assertStringIncludes(journalsBackfill, "from public.days");
  // Deliberately a content test, not `prompts <> '[]'`: the old shared row seeded
  // template prompts with empty responses on the first *note* write, so the shape
  // test would import ~113 of 162 production rows the user never journaled in.
  assertStringIncludes(journalsBackfill, "jsonb_array_elements(prompts)");
  assertStringIncludes(journalsBackfill, "entry ->> 'response'");
  // And guard the array type, since `days.prompts` has no array constraint and
  // `jsonb_array_elements` raises on a non-array — which would abort the whole
  // migration.
  assertStringIncludes(journalsBackfill, "jsonb_typeof(prompts) = 'array'");
  assertStringIncludes(
    journalsBackfill,
    "on conflict (user_id, date) do nothing",
  );
});

Deno.test("both tables join the realtime publication, guarded", () => {
  assertStringIncludes(code, "array['journals', 'notes']");
  assertStringIncludes(code, "from pg_publication_tables");
  assertStringIncludes(
    code,
    "alter publication supabase_realtime add table public.%i",
  );
});

Deno.test("days is left intact by the split itself", () => {
  // The migration reads `days` (the backfill) but must never alter or drop it.
  // `days` is gone as of DEX-90 (20260727035544_drop_days.sql) — dropping it in
  // a later, separate migration is what keeps this one replayable from the
  // baseline, since both backfills above select `from public.days`.
  assert(
    !code.includes("drop table") && !code.includes("alter table public.days"),
    "the split must not modify or drop public.days",
  );
});
