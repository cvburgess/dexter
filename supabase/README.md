# Supabase (`/supabase`)

Deno Edge Functions, SQL migrations, and Supabase CLI configuration for Dexter.

## Layout

- `config.toml` — local Supabase settings (ports, auth URL for Expo web, etc.)
- `functions/ics-proxy/` — production Edge Function for proxying public `.ics`
  calendar URLs
- `migrations/` — ordered SQL migrations, including the production baseline
- `seed.sql` — optional local seed data; the baseline currently requires none

## Commands

```bash
deno fmt
deno lint functions/ics-proxy/index.ts
```

When `__tests__/` exists:

```bash
deno test --allow-all --config __tests__/deno.json __tests__/
```

Use the [Supabase CLI](https://supabase.com/docs/guides/cli) for
`supabase start`, linking projects, and deploying functions (requires Docker for
local stack).

## Edge Functions

### `ics-proxy`

- Runtime: Deno.
- JWT verification: disabled in `config.toml`, matching production.
- Required secrets: none. The function accepts a `url` query parameter and
  proxies the calendar feed at that URL.
- Because the endpoint is public, the target URL is validated in `validation.ts`
  to prevent open-proxy/SSRF abuse: only `http`/`https` schemes are allowed, the
  URL must point at an `.ics` file (checked against the pathname, so tokenized
  feeds like `cal.ics?token=…` work), URLs may not embed credentials, and
  private/loopback/link-local/cloud-metadata hosts are blocked. Redirects are
  followed manually and each hop is re-validated against the same host rules.
- Inbound request headers are never forwarded upstream — an explicit outbound
  header allowlist is used — so caller credentials cannot leak to the target
  host. Responses are capped at 5 MB with a 10s timeout.

## Edge runtime

Functions run on **Deno**. Avoid Node-only APIs (`fs`, `path` from `node:`,
etc.).

For Postgres and RLS guidance, see
[`.claude/skills/supabase-postgres-best-practices/SKILL.md`](../.claude/skills/supabase-postgres-best-practices/SKILL.md).
