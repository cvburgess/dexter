# Supabase (`/supabase`)

Deno Edge Functions, SQL migrations, and Supabase CLI configuration for Dexter.

## Layout

- `config.toml` — local Supabase settings (ports, auth URL for Expo web, etc.)
- `functions/` — one directory per Edge Function (`index.ts` + `deno.json`)
- `migrations/` — ordered SQL migrations
- `seed.sql` — optional local seed data

## Commands

```bash
deno fmt
deno lint functions/hello/index.ts
```

When `__tests__/` exists:

```bash
deno test --allow-all --config __tests__/deno.json __tests__/
```

Use the [Supabase CLI](https://supabase.com/docs/guides/cli) for
`supabase start`, linking projects, and deploying functions (requires Docker for
local stack).

## Edge runtime

Functions run on **Deno**. Avoid Node-only APIs (`fs`, `path` from `node:`,
etc.).

For Postgres and RLS guidance, see
[`.claude/skills/supabase-postgres-best-practices/SKILL.md`](../.claude/skills/supabase-postgres-best-practices/SKILL.md).
