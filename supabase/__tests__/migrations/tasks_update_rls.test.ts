import { assert, assertEquals, assertStringIncludes } from "@std/assert";

// DEX-32: regression guard for the tasks UPDATE RLS policy.
//
// The backend CI runs `deno test` with no Postgres, so this is a static check
// over the migration SQL rather than a live-DB integration test. It asserts the
// two properties the fix must hold: (1) the tasks UPDATE policy's WITH CHECK no
// longer sub-selects from `public.tasks` (the self-reference that caused the
// 42P17 infinite recursion), and (2) it still enforces post-update ownership
// plus the non-recursive list/goal/template FK-ownership guards from DEX-4.

const migrationUrl = new URL(
  "../../migrations/20260712141905_fix_tasks_update_rls_recursion.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationUrl);

// Extract the `create policy ... for update ... ;` statement for tasks so the
// assertions can't be satisfied by unrelated policies or comment text.
function tasksUpdatePolicy(source: string): string {
  const stripped = source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  const start = stripped.indexOf(
    'create policy "Users can update their own tasks"',
  );
  assert(start !== -1, "tasks UPDATE policy not found in migration");
  const end = stripped.indexOf(";", start);
  assert(end !== -1, "tasks UPDATE policy is not terminated");
  return stripped.slice(start, end + 1).toLowerCase();
}

Deno.test("tasks UPDATE policy does not self-reference public.tasks (no 42P17)", () => {
  const policy = tasksUpdatePolicy(sql);
  assert(
    !policy.includes("from public.tasks"),
    "tasks UPDATE policy must not sub-select from public.tasks; a self-referential " +
      'guard causes `42P17 infinite recursion detected in policy for relation "tasks"`',
  );
  assertEquals(
    policy.includes("subtask_of"),
    false,
    "the recursive subtask_of guard must be removed from the tasks UPDATE policy",
  );
});

Deno.test("tasks UPDATE policy preserves ownership and non-recursive FK guards", () => {
  const policy = tasksUpdatePolicy(sql);
  // Post-update ownership is still required in WITH CHECK, not just USING.
  const withCheck = policy.slice(policy.indexOf("with check"));
  assertStringIncludes(withCheck, "auth.uid");
  assertStringIncludes(withCheck, "user_id");
  // The safe, cross-table FK-ownership guards from DEX-4 remain intact.
  assertStringIncludes(withCheck, "from public.lists");
  assertStringIncludes(withCheck, "from public.goals");
  assertStringIncludes(withCheck, "from public.repeat_task_templates");
});
