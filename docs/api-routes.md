# API routes

Every callable backend surface: the Edge Functions, the one search RPC, the
scheduled job, and the OAuth server. Conventions shared by all of them — Deno
runtime, Sentry wrapping, RLS invariants — live in `docs/backend.md`.

## `ics-proxy`

Public (JWT verification off), no secrets. Target URLs are hardened against
open-proxy/SSRF in `validation.ts`: `http(s)` only, `.ics` pathname, no embedded
credentials, private/loopback/link-local/cloud-metadata hosts blocked across
manually-followed redirect hops. Inbound headers are never forwarded (explicit
outbound allowlist); responses capped at 5 MB / 10s.

## `mcp-server`

Gateway JWT verification off so it validates bearer tokens inline: a
publishable-key client with the incoming `Authorization` header,
`auth.getUser()`, then that user-scoped client for all tools so **RLS remains the
enforcement layer**; the service role key is not used. It validates browser
`Origin` headers (DNS-rebinding protection; no-Origin requests are allowed for
desktop clients). Tool inputs never accept `user_id` — ownership derives from the
token.

**Tool params carry `.describe()`, not tool-level prose** — the status and
priority schemas describe their own 0–4 numbering and contrast each other, because
agents were writing a priority into `status` (DEX-137). A `z.union` does not
inherit its members' descriptions and needs its own.

## `generate-horoscopes`

Gateway JWT verification off for a reason worth stating plainly: **`verify_jwt` is
authentication of the project, not authorization of the caller** — any signed-in
user's token passes, and so does the publishable key that ships in the app
bundle. On an endpoint that spends paid quota that is no gate at all; it instead
requires an `x-cron-secret` header matching `HOROSCOPE_CRON_SECRET`, compared in
constant time. Don't "harden" this by flipping `verify_jwt` on.

It is also the one function using the **service role key**: horoscopes are global
rows no user owns, so there is no user whose privileges could write them; the
exposure is bounded by never reading a caller-supplied identifier and never
returning row data. The table itself is in `docs/features.md` (Ritual →
Horoscope).

## `verify-demo-otp`

Login is passwordless, so an App Store reviewer can't receive a code out of band.
This function bridges the gap: demo email + fixed code (`DEMO_OTP`) exchanges for
a real session.

- **Identity is shared, not duplicated by drift** — `_shared/demoAuth.ts` exports
  `DEMO_EMAIL` (matched exactly, never a domain) and `deriveDemoPassword(otp)`;
  `seed-demo` sets the password to `deriveDemoPassword(DEMO_OTP)` and the function
  signs in with the same derived value, so the only shared secret is `DEMO_OTP`.
  The app re-declares `DEMO_EMAIL`/`isDemoEmail` in `src/hooks/useAuth.tsx` (it
  can't import the Deno module); keep them identical.
- **Publishable key, not service role** — one constant rejection for any bad
  input (can't probe accounts), then a normal `signInWithPassword`. Public and
  unthrottled, so `DEMO_OTP` must be **long and random**, not 6 digits; the login
  screen's demo path accepts a long non-numeric code.
- **The login email carries both a link and the code** —
  `templates/magic_link.html` renders `{{ .Token }}` alongside the link.
  `config.toml`'s template mapping only applies to the **local** stack; the hosted
  project's Magic Link template is dashboard-managed — paste the file into
  Authentication → Email Templates or production emails carry only the link. See
  `docs/appstore.md` for the reviewer flow.

## `search_entries(query text)`

DEX-47, and the whole of search: a uniform `(kind, entry_date, task, prompt,
content)` row set over task/subtask titles, `notes.content`, and — one row per
matching response — journal responses. Both the app (`src/api/search.ts`) and the
MCP `search` tool call it, so swapping the matching strategy changes its body and
neither caller.

- **Journal prompts are returned but never matched against.** Prompts are seeded
  from a shared template, so matching them would return every entry the user ever
  wrote for a query like "well". Only responses are the user's own text; an
  unanswered prompt can never be a hit.
- **It is `SECURITY INVOKER`, and that is load-bearing**: it runs under the
  caller's JWT so RLS scopes all three branches. A `DEFINER` function would make
  scoping depend on hand-written `user_id` filters — three chances to leak a
  journal. This is also why the MCP `search` tool alone adds no `user_id` filter
  (pinned in `__tests__/mcp-server/tools.test.ts`).
- **Matching is substring `ilike`, ANDed across terms** — not `tsvector`, because
  the UI highlights exact matched offsets (stemming leaves nothing to mark) and
  mid-word queries work ("eisen" finds "eisenhower"). At this corpus size there is
  no result set to rank. There is deliberately no index; if that changes,
  `pg_trgm` + a GIN index makes leading-wildcard `ilike` indexable without
  touching the query.
- Two details are load-bearing and easy to drop in a rewrite: each term escapes
  LIKE's `\`, `%`, `_` metacharacters (unescaped, `%` matches every row), and each
  branch carries its own `exists (select 1 from terms)` guard (with zero terms, a
  blank query would return the caller's entire corpus).

## Scheduled job: `dex84-generate-horoscopes`

`select public.trigger_generate_horoscopes();` at **06:00, 07:00 and 08:00 UTC**,
POSTing to `generate-horoscopes` through pg_net. The repo's only pg_cron job and
only Vault use.

- **Three runs because each is nearly free**: the function requests only the signs
  missing for the target date, so the later runs are retries for signs that failed
  — fifty times less code than in-function retry. They cost nothing on a complete
  day, returning `skipped: true` without a single upstream call.
- **The endpoint is never in the migration.** Preview branches replay migrations
  against a different project ref, so a hardcoded URL would point every open PR's
  database at production on a timer. URL and secret come from Vault (per-project,
  not in git); everywhere Vault is empty the job is inert by design (`NULL`, no
  request).
- **The deadline is 10:00 UTC** (earliest local midnight on Earth is UTC+14), and
  since DEX-145 there is no lower bound at all: v3 takes an explicit ISO `date`
  and echoes it back, so which day is being generated is a request parameter
  rather than an inference. The predecessor was not so kind — AstrologyAPI's
  `timezone` body param was relative to its own IST clock, so the intuitive
  `timezone: 0` tested clean between 00:00 and 18:29 UTC and silently returned the
  day after tomorrow outside that window. `index.ts` still reports any
  `expected`-vs-written date disagreement to Sentry, now as an assertion that the
  upstream honored the request: a silent mismatch would re-fetch the same signs
  forever on metered calls.
- **Observability, in increasing trustworthiness:** `cron.job_run_details` proves
  only that the statement fired (pg_net is async — "succeeded" is compatible with
  a 500); `net._http_response` has the real HTTP outcome but a ~6 hour TTL; the
  `horoscopes` row counts and Sentry are the only durable signals. pg_net's
  timeout does **not** cancel the Edge Function, so `timed_out = true` can coexist
  with a successful generation — which is why the function short-circuits when the
  day's rows exist and a naive retry must not be added.
  `select public.trigger_generate_horoscopes();` is a complete manual smoke test:
  `NULL` = unprovisioned, a number = enqueued.

**Provisioning** (once, after the function is deployed): create Vault secrets
`generate_horoscopes_url` (the function URL) and `generate_horoscopes_secret`
(must equal the `HOROSCOPE_CRON_SECRET` function secret — rotate the two together
or the job 401s silently every morning). **Rotation** uses `vault.update_secret`
(`create_secret` raises on a duplicate name):

```sql
select vault.update_secret(id, '<new value>')
  from vault.secrets where name = 'generate_horoscopes_secret';
```

## OAuth server (MCP authorization)

`mcp-server` validates bearer tokens but doesn't issue them — Supabase Auth's
built-in OAuth 2.1 server does (`[auth.oauth_server]` in `config.toml`, dynamic
registration off). The consent redirect goes to
`{site_url}/oauth/consent?authorization_id=…`, which is the Expo screen at
`src/app/oauth/consent.tsx` (approve/deny via `supabase.auth.oauth.*`; an
unauthenticated visitor is bounced to sign-in and returned). **`site_url` must
match the Expo web port** (8081 locally) or the redirect 404s.

Every client must be pre-registered with its exact redirect URI via the Auth Admin
OAuth API using the service-role key (Claude.ai/Desktop:
`https://claude.ai/api/mcp/auth_callback`; others per their docs). **Claude Code**
uses a dynamic loopback port, which a fixed redirect URI cannot match — enabling
dynamic registration for that flow is the open path before advertising Claude Code
support.
