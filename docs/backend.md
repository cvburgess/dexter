# Backend (`/supabase`)

The Dexter backend is hosted on [Supabase](https://supabase.com/docs): PostgreSQL (with RLS), Auth, Storage as needed, and **Edge Functions** (Deno/TypeScript).

All backend config and migrations live under `/supabase`.

## Directory layout

- `functions/` — Edge Functions (Deno); one folder per function with `index.ts` and usually `deno.json`
- `migrations/` — SQL migrations (timestamped filenames)
- `config.toml` — Local Supabase CLI configuration
- `seed.sql` — Optional seed data for local dev (add when needed)

For query optimization, schema design, and RLS guidance, see the repo skill at [`.claude/skills/supabase-postgres-best-practices/SKILL.md`](../.claude/skills/supabase-postgres-best-practices/SKILL.md).

## Edge Functions

- Runtime is **Deno**, not Node: avoid Node-only built-ins and npm packages that assume Node.
- Prefer JSR / `npm:` specifiers compatible with Supabase’s Edge runtime, as in each function’s `deno.json`.

## Local commands

```bash
cd supabase
deno fmt
# When tests exist:
# deno test --allow-all --config __tests__/deno.json __tests__/
```

**Supabase CLI** (`supabase start`, migrations, deploy) requires Docker and CLI setup; see [Supabase CLI docs](https://supabase.com/docs/guides/cli).

## Secrets

Configure secrets via Supabase dashboard or CLI for deployed projects; reference them from function code with `Deno.env.get(...)`. Do not commit real keys.
