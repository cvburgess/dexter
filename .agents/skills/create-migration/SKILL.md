---
name: create-migration
description: Create a new Supabase database migration following project conventions. Use when the user wants to add or change a table, column, index, RLS policy, trigger, or database function.
---

# Create Database Migration

Schema changes are made by editing the declarative schema files in
`supabase/schemas/` — never by writing DDL by hand. The pg-delta engine
(`supabase db schema declarative sync`) generates a normal migration from the
diff, which ships and deploys exactly like every migration before it
(DEX-227).

## Instructions

### Step 1: Understand the change

Read the user's description of the schema change they want to make.

### Step 2: Research current schema

1. Find the object in `supabase/schemas/` — one file per table under
   `schemas/public/tables/`, per function under `schemas/public/functions/`,
   enums under `schemas/public/types/`. Cluster-level objects (extensions,
   publications) live in `schemas/_cluster/`. The layout is for readability
   only; the engine orders statements by dependency automatically.
2. Read `docs/backend.md` for the rules that apply to any table (RLS
   invariants, grants, enums, realtime, migration ordering), and the relevant
   `docs/features.md` section for what the table being changed already stores
   and why.
3. Read `src/types/database.types.ts` to see what the app currently expects.

For query optimization, RLS performance, and schema design guidance, see the
[Supabase Postgres Best Practices skill](../supabase-postgres-best-practices/SKILL.md).

### Step 3: Edit the schema files

Edit `supabase/schemas/` to describe the state you want. Conventions the files
follow:

- Append new columns to the **end** of a table's column list.
- New tables: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`,
  `user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON
  DELETE CASCADE`, `created_at timestamptz NOT NULL DEFAULT now()`,
  `updated_at timestamptz DEFAULT now()`, `archived_at timestamptz` for soft
  delete, index on `user_id`, RLS enabled with **per-operation** policies
  (SELECT, INSERT, UPDATE, DELETE) keyed on `auth.uid() = user_id`.
- `timestamptz` for timestamps (not `timestamp`); `jsonb` (not `json`).
- Grants must be stated explicitly on any new table — see `docs/backend.md`.

### Step 4: Generate the migration

```bash
supabase db schema declarative sync -f <snake_case_name> --no-apply
```

No timestamp or file name juggling — the CLI writes
`supabase/migrations/<timestamp>_<name>.sql`. The `--no-apply` flag writes the
file without touching the local database; apply it with `db reset` (Step 6) so
the reset exercises the whole chain.

**Review the generated migration before committing.** pg-delta models most
entities, but two things to look for:

- **Default-privilege GRANT/REVOKEs on new objects.** If the migration grants
  privileges you didn't intend (default privileges leaking through), strip
  those lines and state the grants you want explicitly.
- **Destructive statements** (`drop`, `truncate`, `delete`) get flagged by the
  CLI — double-check each one before keeping it.

### Step 5: Test locally

```bash
supabase db reset
```

This replays every migration in order and loads seed data. Verify the new
migration applies cleanly. No Docker needed — the local stack is native and
per-directory (DEX-226). If the stack isn't up, start it with
`.agents/skills/start-dev-server/scripts/get-local-stack.sh`, not a bare
`supabase start` — that uses `config.toml`'s fixed ports and collides with
other worktrees' stacks.

### Step 6: Generate updated types

```bash
supabase gen types typescript --local > src/types/database.types.ts
npx prettier --write src/types/database.types.ts
```

Keep the `/* eslint-disable */` first line — the file is linted, not ignored,
and it's generated code. Nothing regenerates types in CI — production
migrations never update `src/types/database.types.ts`. Committing the
regenerated file with the migration is the only way it stays current. Expect
the PostgrestVersion marker to change when the CLI version moves; run
`npm run typecheck` after regenerating.

### Step 7: Remind user about PR workflow

When a PR is opened with changes in `supabase/migrations/`, a Supabase preview
branch is automatically created. The migration will be tested against an
isolated database before merging.

## Escape hatches

- **Data migrations are still hand-written.** `sync` diffs schema *state*, so
  `insert`/`update`/`delete` (including storage buckets, which are rows in
  `storage.buckets`) never appear. Write those migrations by hand in
  `supabase/migrations/` and never put DML in a schema file — it's an error.
  Backfills, Vault secrets, and one-off scripts belong here too.
- **Objects pg-delta can't manage** go in `supabase/schemas/_custom/` as
  hand-authored SQL, with the change itself delivered through a versioned
  migration that sorts before the generated migration that depends on it.
  The engine prints a warning naming anything it can't track; never ignore
  one.
- **Don't hand-edit old migrations.** If a generated migration conflicts with
  reality, fix the schema files and re-run `sync`. The schema files win —
  rebase and re-sync rather than hand-merging migrations.

## Merge-order rule (unchanged)

Each migration must still stand alone: production applies them with
`supabase db push --include-all`, so a migration can land after one with a
later timestamp. Two PRs syncing from the same base can generate overlapping
diffs — rebase, re-run `sync`, and resolve by editing the schema files, not
the migrations. See `docs/backend.md` → Deployment (CI/CD).
