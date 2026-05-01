# Backend (`/supabase`)

The Dexter backend is hosted on [Supabase](https://supabase.com/docs): PostgreSQL (with RLS), Auth, Storage as needed, and **Edge Functions** (Deno/TypeScript).

All backend config and migrations live under `/supabase`.

## Directory layout

- `functions/ics-proxy/` — production Edge Function for proxying public `.ics` calendar URLs
- `functions/mcp-server/` — MCP-compatible planning data server for authenticated AI clients
- `migrations/` — SQL migrations (timestamped filenames), including the production baseline
- `config.toml` — Local Supabase CLI configuration
- `seed.sql` — Optional seed data for local dev; the production baseline currently requires none

For query optimization, schema design, and RLS guidance, see the repo skill at [`.claude/skills/supabase-postgres-best-practices/SKILL.md`](../.claude/skills/supabase-postgres-best-practices/SKILL.md).

## Edge Functions

- Runtime is **Deno**, not Node: avoid Node-only built-ins and npm packages that assume Node.
- Prefer JSR / `npm:` specifiers compatible with Supabase’s Edge runtime, as in each function’s `deno.json`.
- `ics-proxy` has JWT verification disabled and requires no configured function secrets.
- `mcp-server` also has Supabase JWT verification disabled at the function
  gateway so it can validate bearer tokens inline. It creates an anon-key
  Supabase client with the incoming `Authorization: Bearer <token>` header,
  calls `auth.getUser()`, and uses that user-scoped client for all tools so RLS
  policies remain the enforcement layer. The service role key is not used.
- `mcp-server` validates browser `Origin` headers for MCP DNS-rebinding
  protection. Requests without an `Origin` are allowed for desktop MCP clients.
  Trusted origins include localhost/dev clients, common AI client origins,
  `https://dexterplanner.com`, and `https://app.dexterplanner.com`.
- MCP tool groups cover tasks, goals, lists, habits and daily habit progress,
  days, repeat task templates, and preferences. Tool inputs never accept
  `user_id`; user ownership is derived from the validated bearer token.

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

Current production Edge Functions do not require committed secret names.
