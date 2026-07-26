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
    // `add constraint` has no IF NOT EXISTS in Postgres, so re-run safety comes
    // from each one being preceded by a `drop constraint if exists` (asserted
    // separately below).
    const isConstraintAdd = statement.includes("add constraint");
    assert(
      isConstraintAdd ||
        statement.includes("if not exists") ||
        statement.includes("if exists"),
      `every statement must be guarded for re-run safety: ${statement}`,
    );
  }

  for (const statement of all.filter((s) => s.includes("add constraint"))) {
    const name = /add constraint (\S+)/.exec(statement)?.[1];
    assert(name, `could not read the constraint name from: ${statement}`);
    assert(
      all.some((s) =>
        s.includes("drop constraint if exists") && s.includes(name)
      ),
      `${name} must be dropped-if-exists before being added, or a re-run fails`,
    );
  }

  // Subtasks live inside owner-guarded rows, so the migration must not touch
  // policies or add triggers — that absence is the design, not an oversight.
  assert(
    !sql.includes("create policy") && !sql.includes("create trigger"),
    "subtasks require no new policies or triggers",
  );
});

Deno.test("both subtasks columns are constrained to hold a JSON array", () => {
  // Every reader treats the column as an array without type-guarding, and
  // `jsonb` alone would permit an object, string, or number.
  const checks = statements(sql).filter((s) => s.includes("jsonb_typeof"));

  for (const table of ["public.tasks", "public.repeat_task_templates"]) {
    assert(
      checks.some((s) =>
        s.includes(table) && s.includes("jsonb_typeof(subtasks) = 'array'")
      ),
      `${table}.subtasks must be constrained to a JSON array`,
    );
  }
});
