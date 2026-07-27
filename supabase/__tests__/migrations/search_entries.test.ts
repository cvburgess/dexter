import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import { statements, withoutComments } from "./sqlStatements.ts";

// DEX-47: static guards over the search_entries RPC.
//
// Backend CI runs `deno test` with no Postgres, so these assert over the
// migration SQL text. They pin the properties both callers (the app's
// `src/api/search.ts` and the MCP server's `tools/search.ts`) depend on, plus
// the two ways this function could silently hand a user the wrong rows: losing
// SECURITY INVOKER (and with it RLS scoping), and losing either guard that stops
// a query from matching everything.

const migrationUrl = new URL(
  "../../migrations/20260727232854_add_search_entries.sql",
  import.meta.url,
);
const raw = await Deno.readTextFile(migrationUrl);
const sql = raw.toLowerCase();
// Comment-free text, so the header prose — which spells out most of these
// choices — can't satisfy an assertion on its own.
const code = withoutComments(sql);

// The whole migration is a single statement: a `language sql` body holding one
// query carries no internal semicolons for `statements()` to split on.
function searchFunction(): string {
  const statement = statements(sql).find((s) =>
    s.includes("create or replace function public.search_entries")
  );
  assert(statement, "public.search_entries must be created");
  return statement;
}

Deno.test("search_entries takes one text query and returns the uniform result shape", () => {
  const fn = searchFunction();

  assertStringIncludes(fn, "function public.search_entries(query text)");
  // Both callers destructure these five columns by name; the app's
  // TSearchResult union is keyed on `kind`.
  for (
    const column of [
      "kind text",
      "entry_date date",
      "task jsonb",
      "prompt text",
      "content text",
    ]
  ) {
    assertStringIncludes(fn, column);
  }
  assertStringIncludes(fn, "language sql");
  assertStringIncludes(fn, "stable");
});

Deno.test("search_entries runs SECURITY INVOKER so RLS scopes it to the caller", () => {
  const fn = searchFunction();

  // The load-bearing assertion. DEFINER would bypass RLS and make correct
  // per-user scoping depend on a hand-written `user_id = auth.uid()` filter in
  // each of the three branches — three chances to leak another user's journal.
  assertStringIncludes(fn, "security invoker");
  assert(
    !fn.includes("security definer"),
    "search_entries must not be SECURITY DEFINER",
  );
  assertStringIncludes(fn, "set search_path to 'public', 'pg_temp'");
});

Deno.test("query terms escape LIKE's metacharacters", () => {
  // Unescaped, a query containing `%` matches every row and `_` matches any
  // single character — "50%" would return the caller's entire corpus.
  // Backslash must be escaped first or it would double the escapes added after
  // it; `\` is LIKE's default escape character, so no ESCAPE clause is needed.
  assertStringIncludes(
    code,
    String
      .raw`replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_')`,
  );
});

Deno.test("every branch guards against a query with no usable terms", () => {
  // With zero terms (empty or all-whitespace input) the `not exists (... where
  // ... not ilike ...)` test is vacuously true for every row, so without this
  // guard each branch returns everything. Each of the three branches needs its
  // own copy — hence a count, not a presence check. The closing paren keeps
  // this from also matching the `not exists (select 1 from terms where ...)`
  // clauses.
  const guards = code.match(/exists \(select 1 from terms\)/g) ?? [];
  assertEquals(
    guards.length,
    3,
    "each of the three union branches needs its own empty-query guard",
  );
});

Deno.test("every term must match, rather than the query matching as one phrase", () => {
  // "buy milk" should find a note reading "milk — remember to buy", so terms are
  // split on whitespace and ANDed via `not exists (a term that doesn't match)`.
  assertStringIncludes(
    code,
    String.raw`unnest(regexp_split_to_array(btrim(query), '\s+'))`,
  );
  const negated = code.match(/not ilike terms\.pattern/g) ?? [];
  assertEquals(negated.length, 3, "each branch ANDs the terms the same way");
});

Deno.test("tasks match on their own title or any subtask title", () => {
  const fn = searchFunction();

  assertStringIncludes(fn, "from public.tasks t");
  // Subtasks are jsonb inside the parent row, not rows of their own, so a
  // subtask hit surfaces the parent card.
  assertStringIncludes(fn, "jsonb_array_elements(t.subtasks) as subtask");
  assertStringIncludes(fn, "string_agg(subtask ->> 'title', ' ')");
  // A column list would need editing every time a task column is added; the
  // client casts this straight to TTask.
  assertStringIncludes(fn, "to_jsonb(t) as task");
  assertStringIncludes(fn, "t.scheduled_for as entry_date");
});

Deno.test("notes match on content", () => {
  const fn = searchFunction();

  assertStringIncludes(fn, "from public.notes n");
  assertStringIncludes(fn, "n.content not ilike terms.pattern");
});

Deno.test("journals return one row per matching prompt, null-guarded", () => {
  const fn = searchFunction();

  assertStringIncludes(fn, "from public.journals j");
  // Per matching prompt, not per day: the UI shows which question the hit came
  // from, and a day holds several.
  assertStringIncludes(
    fn,
    "cross join lateral jsonb_array_elements(j.prompts)",
  );
  assertStringIncludes(fn, "p ->> 'prompt'");
  assertStringIncludes(fn, "p ->> 'response'");
  // `prompts` is only constrained to be an array, not to the shape of its
  // elements. A null `->>` would make `not ilike` evaluate to NULL, the inner
  // `exists` find nothing, and the row match every query.
  assertStringIncludes(fn, "coalesce(p ->> 'prompt', '')");
  assertStringIncludes(fn, "coalesce(p ->> 'response', '')");
});

Deno.test("results come back most-recent-first with undated tasks last", () => {
  // Substring matching has no relevance score to sort by. Undated (backlog)
  // tasks have a null entry_date and belong at the end, not the start.
  assertStringIncludes(
    searchFunction(),
    "order by results.entry_date desc nulls last",
  );
});

Deno.test("the sort key is table-qualified, not a bare column name", () => {
  const fn = searchFunction();

  // RETURNS TABLE puts `kind`/`entry_date`/`task`/`prompt`/`content` in scope
  // inside the body as OUT parameters, so a bare `order by entry_date` is
  // ambiguous between the parameter and the output column. That is why the
  // union is wrapped in a subquery and ordered from outside — reverting to a
  // bare name would break the function at creation time, not at call time.
  assertStringIncludes(fn, ") as results");
  assert(
    !/order by entry_date/.test(fn),
    "order by must qualify entry_date to avoid the OUT-parameter collision",
  );
});

Deno.test("the migration only adds a function", () => {
  // Search needed no schema change: no new column, no index, no RLS edit. If
  // that ever changes, this test should be updated deliberately rather than
  // quietly outgrown.
  assert(
    !code.includes("create table") && !code.includes("alter table") &&
      !code.includes("create index") && !code.includes("create policy"),
    "search_entries should not touch tables, indexes, or policies",
  );
});
