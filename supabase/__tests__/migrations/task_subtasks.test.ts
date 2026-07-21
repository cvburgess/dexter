import { assert, assertStringIncludes } from "@std/assert";

// DEX-70: static guards over the subtasks migration.
//
// Like `tasks_update_rls.test.ts`, backend CI runs `deno test` with no Postgres,
// so these assert over the migration SQL text rather than a live database.

const migrationUrl = new URL(
  "../../migrations/20260721182025_add_task_subtasks.sql",
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

Deno.test("subtasks is added to both tasks and repeat_task_templates", () => {
  const added = statements(sql).filter((statement) =>
    statement.includes("add column") && statement.includes("subtasks")
  );

  for (const table of ["public.tasks", "public.repeat_task_templates"]) {
    const statement = added.find((s) => s.includes(table));
    assert(statement, `subtasks column must be added to ${table}`);
    // NOT NULL DEFAULT '[]' matters: every read path treats subtasks as an
    // array without null-guarding, and existing rows must backfill to empty.
    assertStringIncludes(statement, "jsonb");
    assertStringIncludes(statement, "not null");
    assertStringIncludes(statement, "default '[]'");
  }
});

Deno.test("the unused subtask_of column, its FK, and its index are dropped", () => {
  const all = statements(sql);

  assert(
    all.some((s) =>
      s.includes("drop column") && s.includes("subtask_of") &&
      s.includes("public.tasks")
    ),
    "tasks.subtask_of must be dropped",
  );
  assert(
    all.some((s) =>
      s.includes("drop constraint") && s.includes("tasks_subtask_of_fkey")
    ),
    "the tasks_subtask_of_fkey constraint must be dropped",
  );
  assert(
    all.some((s) =>
      s.includes("drop index") && s.includes("idx_tasks_subtask_of")
    ),
    "the idx_tasks_subtask_of index must be dropped",
  );
});

Deno.test("the migration is idempotent and adds no RLS or trigger surface", () => {
  const all = statements(sql);

  for (const statement of all) {
    assert(
      statement.includes("if not exists") || statement.includes("if exists"),
      `every statement must be guarded for re-run safety: ${statement}`,
    );
  }

  // Subtasks live inside owner-guarded rows, so the migration must not touch
  // policies or add triggers — that absence is the design, not an oversight.
  assert(
    !sql.includes("create policy") && !sql.includes("create trigger"),
    "subtasks require no new policies or triggers",
  );
});
