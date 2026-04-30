# Create Database Migration

Create a new Supabase database migration following project conventions.

## Instructions

### Step 1: Understand the change

Read the user's description of the schema change they want to make.

### Step 2: Research current schema

1. Read `src/types/database.types.ts` to understand the current schema
2. Read existing migrations in `supabase/migrations/` to understand conventions
3. Read `docs/backend.md` for schema patterns (RLS, soft deletes, JSONB columns)
4. If the change involves JSONB columns, read `src/types/ingredients.ts` for Zod schemas and `supabase/schemas/` for JSON schema files

For query optimization, RLS performance, and schema design guidance, see the [Supabase Postgres Best Practices skill](/.claude/skills/supabase-postgres-best-practices/SKILL.md).

### Step 3: Generate migration timestamp

```bash
date -u +"%Y%m%d%H%M%S"
```

### Step 4: Write the migration

Create `supabase/migrations/<timestamp>_<description>.sql` following these conventions:

**File naming:** `<YYYYMMDDHHMMSS>_<snake_case_description>.sql`

**SQL conventions:**
- Add a comment header explaining what the migration does and why
- Use `IF NOT EXISTS` / `IF EXISTS` for idempotent DDL where possible
- Use `public.` schema prefix for all table references
- Use `timestamptz` for timestamps (not `timestamp`)
- Use `jsonb` for JSON columns (not `json`)

**For new tables:**
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz DEFAULT now()`
- `archived_at timestamptz` for soft delete support
- Create index on `user_id` for RLS performance
- Enable RLS and create per-operation policies (SELECT, INSERT, UPDATE, DELETE)
- RLS expression: `auth.uid() = user_id`

**For JSONB constraints:**
- Use `extensions.jsonb_matches_schema()` from the `pg_jsonschema` extension
- Derive JSON schemas from the canonical Zod schemas in `src/types/ingredients.ts`

**For destructive changes:**
- Include rollback instructions in comments

### Step 5: Test locally

```bash
supabase db reset
```

This runs all migrations in order and loads seed data. Verify the migration applies cleanly.

### Step 6: Generate updated types

```bash
supabase gen types typescript --local > src/types/database.types.ts
```

Types are auto-generated in CI after production migrations, but updating locally ensures type-safe development.

### Step 7: Remind user about PR workflow

When a PR is opened with changes in `supabase/migrations/`, a Supabase preview branch is automatically created. The migration will be tested against an isolated database before merging.
