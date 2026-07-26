// Backend CI runs `deno test` with no Postgres, so the migration tests assert
// over the migration SQL text. This splits a migration file into comparable
// statements: comments dropped, split on `;`, whitespace collapsed. Not named
// `*.test.ts`, so `deno test` doesn't collect it as a suite.

export function statements(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
