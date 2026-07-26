// Backend CI runs `deno test` with no Postgres, so the migration tests assert
// over the migration SQL text. This splits a migration file into comparable
// statements: comments dropped, split on `;`, whitespace collapsed. Not named
// `*.test.ts`, so `deno test` doesn't collect it as a suite.

export function statements(source: string): string[] {
  return withoutComments(source)
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * The migration text with comment lines dropped, for assertions that must hold
 * against a whole file rather than one statement — a `do $$ … $$` block carries
 * internal semicolons, so `statements()` fragments it. Stripping comments is the
 * point: a migration's header prose would otherwise satisfy assertions on its own.
 */
export function withoutComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}
