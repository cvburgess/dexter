# Backend (`/supabase`)

The Dexter backend is hosted on [Supabase](https://supabase.com/docs):
PostgreSQL (with RLS), Auth, Storage as needed, and **Edge Functions**
(Deno/TypeScript).

All backend config and migrations live under `/supabase`.

## Directory layout

- `functions/ics-proxy/` — production Edge Function for proxying public `.ics`
  calendar URLs
- `functions/mcp-server/` — MCP-compatible planning data server for
  authenticated AI clients
- `migrations/` — SQL migrations (timestamped filenames), including the
  production baseline
- `config.toml` — Local Supabase CLI configuration
- `seed.sql` — Optional seed data for local dev; the production baseline
  currently requires none

For query optimization, schema design, and RLS guidance, see the repo skill at
[`.claude/skills/supabase-postgres-best-practices/SKILL.md`](../.claude/skills/supabase-postgres-best-practices/SKILL.md).

## RLS policy invariants

Every user-owned table enables RLS with per-operation policies keyed on
`auth.uid() = user_id`. Two invariants must hold for every table:

- **UPDATE policies must constrain `WITH CHECK`, not just `USING`.** `USING`
  gates the pre-update row; `WITH CHECK` gates the post-update row. An UPDATE
  policy with `with check (true)` lets a user reassign `user_id` to another user
  (ownership transfer). Always require `(select auth.uid()) = user_id` in
  `WITH CHECK` so ownership is preserved across updates.
- **Tenant-scoped foreign keys must reference rows the caller owns.** Where a
  row points at another user-owned row (e.g. `tasks.list_id`/`goal_id`/
  `template_id`/`subtask_of`, `repeat_task_templates.list_id`/`goal_id`,
  `daily_habits.habit_id`), the `WITH CHECK` clause should confirm the
  referenced row belongs to `auth.uid()` (`is null or exists (...)` for nullable
  FKs) so a user cannot attach another user's records.

## Edge Functions

- Runtime is **Deno**, not Node: avoid Node-only built-ins and npm packages that
  assume Node.
- Prefer JSR / `npm:` specifiers compatible with Supabase’s Edge runtime, as in
  each function’s `deno.json`.
- `ics-proxy` has JWT verification disabled and requires no configured function
  secrets. Since it is publicly callable, target URLs are hardened against
  open-proxy/SSRF abuse in `functions/ics-proxy/validation.ts`: only `http`/
  `https` schemes are allowed, the pathname must end in `.ics` (query params
  such as feed tokens are preserved), embedded credentials are rejected, and
  private/ loopback/link-local/cloud-metadata hosts are blocked — including
  across manually-followed redirect hops. Inbound headers are never forwarded
  upstream (an explicit outbound allowlist is used) so caller credentials cannot
  leak to the target host, and responses are bounded by a 5 MB size cap and a
  10s timeout.
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
- Both functions report errors to **Sentry** via `functions/_shared/sentry.ts`
  (`npm:@sentry/deno`, aliased in each function's `deno.json` import map since
  there is no shared import map across functions today). `initSentry`/
  `captureException` are graceful no-ops when `SENTRY_DSN` is unset, so local
  dev and tests never need the secret or network access. `mcp-server` wraps
  its `Deno.serve` handler with `withSentry` and captures the previously-
  swallowed top-level error, and every `toolError(...)` result (the shape MCP
  tools return instead of throwing) also reports to Sentry. `ics-proxy` wraps
  its handler the same way and captures unexpected upstream-fetch failures
  without leaking internal error details in the sanitized client response.

## OAuth server (MCP authorization)

The `mcp-server` function validates bearer tokens but does not issue them —
authorization is handled by Supabase Auth's built-in **OAuth 2.1 server**,
enabled in `config.toml`:

```toml
[auth.oauth_server]
enabled = true
authorization_url_path = "/oauth/consent"
allow_dynamic_registration = false
```

When an MCP client (Claude, ChatGPT, Cursor, …) starts the OAuth flow, Supabase
redirects the browser to `{site_url}{authorization_url_path}` —
`http://localhost:8081/oauth/consent?authorization_id=…` locally, or
`https://app.dexterplanner.com/oauth/consent?authorization_id=…` in production.
That route is the Expo screen at `src/app/oauth/consent.tsx`, which reads the
`authorization_id`, shows which client is requesting access, and calls
`supabase.auth.oauth.approveAuthorization` / `denyAuthorization` to finish the
handshake. An unauthenticated visitor is bounced to sign-in with the
`authorization_id` stashed and returned afterward.

> **`site_url` must match the Expo web port.** The consent URL is built as
> `{site_url}{authorization_url_path}`, so `[auth].site_url`
> (`http://localhost:8081`) has to point at wherever the Expo web dev server
> actually serves. 8081 is Expo's default; if you remap the port, update
> `site_url` or the redirect 404s.

### Pre-registering clients

`allow_dynamic_registration = false`, so every client must be registered ahead
of time with its exact redirect URI — an unregistered `redirect_uri` fails the
authorization before the consent screen is ever reached. Register clients with
the Auth Admin OAuth API using the **service-role** key (never ship this key to
a client):

```bash
curl -X POST "$SUPABASE_URL/auth/v1/admin/oauth/clients" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Claude",
    "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
    "grant_types": ["authorization_code", "refresh_token"]
  }'
```

The response returns a `client_id` (and, for confidential clients, a
`client_secret`). Confirm the exact request shape against the
[Supabase Auth OAuth server docs](https://supabase.com/docs/guides/auth), as the
admin API is still evolving.

Redirect URIs to register for the initial clients:

| Client                     | Redirect URI                                                |
| -------------------------- | ----------------------------------------------------------- |
| Claude.ai / Claude Desktop | `https://claude.ai/api/mcp/auth_callback`                   |
| ChatGPT                    | Per ChatGPT's connector docs (confirm at registration time) |
| Cursor / Gemini            | Per each client's docs                                      |

**Claude Code** uses a dynamic loopback port (`http://localhost:<random>/…`),
which a fixed pre-registered redirect URI cannot match. Enabling
`allow_dynamic_registration` for the flows that need it (or registering a
loopback pattern if/when Supabase supports one) is the path for Claude Code;
track this before advertising Claude Code support.

## Local commands

```bash
cd supabase
deno fmt
deno test --allow-all --config __tests__/deno.json __tests__/
```

**Supabase CLI** (`supabase start`, migrations, deploy) requires Docker and CLI
setup; see [Supabase CLI docs](https://supabase.com/docs/guides/cli).

## Deployment (CI/CD)

Backend and app deploys run from GitHub Actions in `.github/workflows/`:

- **`deploy.yml`** — on push to `main` touching `supabase/**` or `src/**` (or
  manual `workflow_dispatch`). Detects which paths changed, then runs, in order:
  `migrate` (`supabase db push`), `deploy-functions`
  (`supabase functions deploy`), and `deploy-eas` (web export → `eas deploy`
  → OTA `eas update`). The migrate/functions jobs run only when `supabase/**`
  changed; the EAS job runs only when `src/**` changed and the backend jobs
  succeeded or were skipped.
- **`test-backend.yml`** — on any `supabase/**` PR/push: `deno fmt --check` plus
  `deno test`. Backend tests set their own env, so no secrets are required.
- **`preview-deploy-functions.yml`** — redeploys edge functions to a PR's
  Supabase preview branch. Supabase's native GitHub integration creates the
  preview branch and applies its migrations, but does not reliably redeploy
  functions on later pushes; this workflow closes that gap, gated on the
  `Supabase Preview` check succeeding.
- **`preview.yml`** — `workflow_dispatch` EAS preview OTA update (`eas update
  --auto`) that comments on the PR.

EAS deploys/updates rely on **EAS Update** wiring in `src/`: the `export:web`
script (`expo export --platform web`), the `expo-updates` dependency, and the
`updates.url` + `runtimeVersion` config in `src/app.json`.

**Required GitHub repo secrets:** `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`,
`SUPABASE_ACCESS_TOKEN` (backend); `EXPO_TOKEN`, `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN` (app/EAS).

> **First-run reconciliation.** Production's migration-history table was empty
> while the schema was already live (migrations had been applied out-of-band),
> so a naive `supabase db push` would fail replaying the baseline. Before the
> first automated run, the applied migrations must be baselined
> (`supabase migration repair --status applied <version>`) and deployed function
> versions redeployed so they match `main`. Enabling the Supabase GitHub
> integration (for preview branches) is a one-time dashboard step.

## Secrets

Configure secrets via Supabase dashboard or CLI for deployed projects; reference
them from function code with `Deno.env.get(...)`. Do not commit real keys.

| Secret       | Used by                        | Required?                                             |
| ------------ | ------------------------------- | ------------------------------------------------------ |
| `SENTRY_DSN` | `mcp-server`, `ics-proxy` | Optional — Sentry reporting no-ops gracefully if unset |
