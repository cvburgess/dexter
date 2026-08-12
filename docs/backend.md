# Backend (`/supabase`)

The Dexter backend is hosted on [Supabase](https://supabase.com/docs):
PostgreSQL (with RLS), Auth, and **Edge Functions** (Deno/TypeScript). Config,
functions, and migrations live under `/supabase`; commands are in `AGENTS.md`.
For query optimization, schema design, and RLS guidance, load the
`supabase-postgres-best-practices` skill before touching the database.

A general rule that keeps repeating: **a new column on a user-owned table needs
no RLS change** — the existing `user_id` policies cover it. Only new tables and
new access patterns need policy work.

## Notes and journals

`public.notes` (`content text`) and `public.journals` (`prompts jsonb`, checked
to be an array), each keyed `(user_id, date)` — one row per user per date, no
`id`, no `updated_at`. They replaced a shared `days` row (DEX-51; `days` dropped
in DEX-90 once the legacy `dexter-app`, which shares this production project,
had shipped a release reading the new tables).

**"No row" means "never written", and the app depends on that** — the notes
template chooser keys off `useNotes`' `exists`. The split's backfill preserved
the distinction deliberately: for journals, only days with at least one
non-empty *response* were copied, because the old shared row seeded template
prompts on the first note write, so most rows carried scaffolding the user
never answered.

## Horoscopes

`public.horoscopes` (DEX-84; rebuilt for astrology-api.io v3 in DEX-145) holds
one sun-sign horoscope per day — a short prose `text`, an `overall_rating`,
three `tips`, and a rating for each of twelve life areas. It is the first table
in this schema that **nobody owns** (global reference data), which drives its
shape:

- **No `user_id`, no `id`.** PK is `(sun_sign, date)` — `sun_sign` first so the
  leftmost prefix also serves `where sun_sign = $1 order by date desc`. No
  secondary index; twelve rows a day is a trivial scan.
- **RLS: a single `for select using (true)` policy and no write policy** — the
  absence of a policy is the denial.
- **Grants must be stated explicitly on any new table.** Default privileges on
  this stack grant no DML to `anon`/`authenticated`/`service_role`; the
  baseline's `grant all` was a one-time snapshot. `service_role` does **not**
  get INSERT for free — BYPASSRLS exempts a role from policies, not grants —
  so both `service_role` INSERT and `authenticated` SELECT are granted by name.
  Check `\dp public.<table>` rather than assuming.
- **`sentiment` is a generated column**, bucketed from `overall_rating` (≥4
  positive, ≤2 negative, else mixed) rather than written by the function. The
  UI groups each life area with the same thresholds, so the card's tint and the
  columns under it cannot disagree. Generated columns need an IMMUTABLE
  expression; a string literal cast to an enum qualifies, a `now()` would not.
- **Build fixtures from a real response, not from the spec.** Learned twice on
  this table. DEX-84 shipped tests against the issue's 2024 sample, which had
  `<facet>_rating` fields the live API no longer sent. DEX-145 then found the
  vendor's published sample showed only the inner object while the wire format
  wraps it in `{ success, data, metadata }` — a schema written from the docs
  would have parsed cleanly and read `undefined` in production.
- Not in the realtime publication (rows change once a day).
- `sun_sign` and `horoscope_sentiment` are the schema's first Postgres enums,
  justified only because both sets are genuinely closed. `tasks.status` and
  `preferences.alarm_sound` stay unconstrained on purpose — those lists grow,
  and enum values can never be removed.

**Which row is yours** is `preferences.sun_sign` (DEX-128) — the same
`public.sun_sign` enum, so the lookup can't drift. It is the one preference
that is **nullable with no default**: guessing a sign would show a stranger's
horoscope as though it were the user's, so "not set" is a real rendered state.
**Whether you see one at all** is `preferences.enable_horoscope` (DEX-142,
`boolean not null default true` — the step shipped on, and any other default
would silently take it away). It is independent of `sun_sign` (toggling off
keeps the chosen sign) and read-side only — generation writes global rows
regardless.

## Scheduled jobs (pg_cron)

`dex84-generate-horoscopes` runs `select public.trigger_generate_horoscopes();`
at **06:00, 07:00 and 08:00 UTC**, POSTing to `generate-horoscopes` through
pg_net. The repo's only pg_cron job and only Vault use.

- **Three runs because each is nearly free**: the function requests only the
  signs missing for the target date, so the later runs are retries for signs
  that failed — fifty times less code than in-function retry. They cost nothing
  on a complete day, returning `skipped: true` without a single upstream call.
- **The endpoint is never in the migration.** Preview branches replay
  migrations against a different project ref, so a hardcoded URL would point
  every open PR's database at production on a timer. URL and secret come from
  Vault (per-project, not in git); everywhere Vault is empty the job is inert
  by design (`NULL`, no request).
- **The deadline is 10:00 UTC** (earliest local midnight on Earth is UTC+14),
  and since DEX-145 there is no lower bound at all: v3 takes an explicit ISO
  `date` and echoes it back, so which day is being generated is a request
  parameter rather than an inference. The predecessor was not so kind —
  AstrologyAPI's `timezone` body param was relative to its own IST clock, so
  the intuitive `timezone: 0` tested clean between 00:00 and 18:29 UTC and
  silently returned the day after tomorrow outside that window. `index.ts`
  still reports any `expected`-vs-written date disagreement to Sentry, now as
  an assertion that the upstream honored the request: a silent mismatch would
  re-fetch the same signs forever on metered calls.
- **Observability, in increasing trustworthiness:** `cron.job_run_details`
  proves only that the statement fired (pg_net is async — "succeeded" is
  compatible with a 500); `net._http_response` has the real HTTP outcome but a
  ~6 hour TTL; the `horoscopes` row counts and Sentry are the only durable
  signals. pg_net's timeout does **not** cancel the Edge Function, so
  `timed_out = true` can coexist with a successful generation — which is why
  the function short-circuits when the day's rows exist and a naive retry must
  not be added. `select public.trigger_generate_horoscopes();` is a complete
  manual smoke test: `NULL` = unprovisioned, a number = enqueued.

**Provisioning** (once, after the function is deployed): create Vault secrets
`generate_horoscopes_url` (the function URL) and `generate_horoscopes_secret`
(must equal the `HOROSCOPE_CRON_SECRET` function secret — rotate the two
together or the job 401s silently every morning). **Rotation** uses
`vault.update_secret` (`create_secret` raises on a duplicate name):

```sql
select vault.update_secret(id, '<new value>')
  from vault.secrets where name = 'generate_horoscopes_secret';
```

## Search

`public.search_entries(query text)` (DEX-47) is the whole of search: a uniform
`(kind, entry_date, task, prompt, content)` row set over task/subtask titles,
`notes.content`, and — one row per matching response — journal responses. Both
the app (`src/api/search.ts`) and the MCP `search` tool call it, so swapping
the matching strategy changes its body and neither caller.

- **Journal prompts are returned but never matched against.** Prompts are
  seeded from a shared template, so matching them would return every entry the
  user ever wrote for a query like "well". Only responses are the user's own
  text; an unanswered prompt can never be a hit.
- **It is `SECURITY INVOKER`, and that is load-bearing**: it runs under the
  caller's JWT so RLS scopes all three branches. A `DEFINER` function would
  make scoping depend on hand-written `user_id` filters — three chances to
  leak a journal. This is also why the MCP `search` tool alone adds no
  `user_id` filter (pinned in `__tests__/mcp-server/tools.test.ts`).
- **Matching is substring `ilike`, ANDed across terms** — not `tsvector`,
  because the UI highlights exact matched offsets (stemming leaves nothing to
  mark) and mid-word queries work ("eisen" finds "eisenhower"). At this corpus
  size there is no result set to rank. There is deliberately no index; if that
  changes, `pg_trgm` + a GIN index makes leading-wildcard `ilike` indexable
  without touching the query.
- Two details are load-bearing and easy to drop in a rewrite: each term
  escapes LIKE's `\`, `%`, `_` metacharacters (unescaped, `%` matches every
  row), and each branch carries its own `exists (select 1 from terms)` guard
  (with zero terms, a blank query would return the caller's entire corpus).

## RLS policy invariants

Every user-owned table enables RLS with per-operation policies keyed on
`auth.uid() = user_id`. Invariants for every table:

- **UPDATE policies must constrain `WITH CHECK`, not just `USING`.** `USING`
  gates the pre-update row, `WITH CHECK` the post-update row; `with check
  (true)` lets a user reassign `user_id` to someone else.
- **Tenant-scoped foreign keys must reference rows the caller owns** — the
  `WITH CHECK` confirms the referenced row belongs to `auth.uid()`
  (`is null or exists (...)` for nullable FKs).
- **A policy must never sub-select the table it guards** — Postgres re-applies
  the policies inside the sub-select and raises `42P17 infinite recursion`
  (DEX-4/DEX-32, via the since-dropped `tasks.subtask_of` guard). A genuine
  cross-owner guard belongs in a `SECURITY DEFINER` helper, never an inline
  sub-select.

## Realtime

All nine user-owned tables are in the `supabase_realtime` publication via
guarded migrations. Membership is **migration-managed** — a dashboard-only
addition would drift from what the migrations declare. Dropping a table drops
it from every publication automatically.

- **RLS gates delivery** — a client only receives events for rows it could
  `SELECT`; there is no separate realtime authorization.
- **DELETE events are not filterable by column** (default `REPLICA IDENTITY`
  puts only PK columns in the `old` record). Only `notes`/`journals`/
  `preferences` key on `user_id`, so for the other six tables the client's
  `user_id=eq.<uuid>` filter can never match a DELETE — deletion-triggered
  invalidation **never fires there, by construction**. Keeping `user_id` in a
  PK is therefore a deliberate schema choice (`(user_id, date)` on
  notes/journals also lets the PK index serve every user-scoped lookup).
- **Client contract: invalidation-only.** `useRealtimeInvalidation` (see
  `docs/frontend.md`) never reads event payloads as data — an event triggers a
  cache invalidation and the refetch goes through the normal RLS-scoped REST
  path. A deleted row on the six tables above persists on screen until the
  next focus/staleness refetch, not the next event.

## Edge Functions

Runtime is **Deno**, not Node; prefer JSR / `npm:` specifiers as in each
function's `deno.json`.

- **`ics-proxy`** — public (JWT verification off), no secrets. Target URLs are
  hardened against open-proxy/SSRF in `validation.ts`: `http(s)` only, `.ics`
  pathname, no embedded credentials, private/loopback/link-local/cloud-metadata
  hosts blocked across manually-followed redirect hops. Inbound headers are
  never forwarded (explicit outbound allowlist); responses capped at 5 MB / 10s.
- **`mcp-server`** — gateway JWT verification off so it validates bearer
  tokens inline: a publishable-key client with the incoming `Authorization`
  header, `auth.getUser()`, then that user-scoped client for all tools so
  **RLS remains the enforcement layer**; the service role key is not used. It
  validates browser `Origin` headers (DNS-rebinding protection; no-Origin
  requests are allowed for desktop clients). Tool inputs never accept
  `user_id` — ownership derives from the token.
- **`generate-horoscopes`** — gateway JWT verification off for a reason worth
  stating plainly: **`verify_jwt` is authentication of the project, not
  authorization of the caller** — any signed-in user's token passes, and so
  does the publishable key that ships in the app bundle. On an endpoint that
  spends paid quota that is no gate at all; it instead requires an
  `x-cron-secret` header matching `HOROSCOPE_CRON_SECRET`, compared in
  constant time. Don't "harden" this by flipping `verify_jwt` on. It is also
  the one function using the **service role key**: horoscopes are global rows
  no user owns, so there is no user whose privileges could write them; the
  exposure is bounded by never reading a caller-supplied identifier and never
  returning row data.
- All functions report to **Sentry** via `functions/_shared/sentry.ts` —
  graceful no-ops when `SENTRY_DSN` is unset, `withSentry`-wrapped handlers,
  and every MCP `toolError(...)` also reports. Triage with the
  `/triage-sentry` skill.

### Shared task semantics

- **Task status/priority enums are shared, not mirrored.**
  `src/utils/taskStatus.ts` / `taskPriority.ts` are imported by the app,
  `mcp-server`, and `scripts/demoData.ts` over the `@src/` alias, and must stay
  **import-free** (Deno requires `.ts` extensions on relative imports;
  Metro/tsc forbid them — which is why the enums can't live in
  `src/api/tasks.ts`, which re-exports them). Values persist as unconstrained
  `smallint`, so the zod schemas are the only rejection of a bogus value.
  Lower priority is *more* urgent; `UNPRIORITIZED` (4) means "never chosen".
- **MCP tool params carry `.describe()`, not tool-level prose** — the status
  and priority schemas describe their own 0–4 numbering and contrast each
  other, because agents were writing a priority into `status` (DEX-137). A
  `z.union` does not inherit its members' descriptions and needs its own.
- **Repeat tasks recur in TypeScript, not Postgres.** Completing a task linked
  to a `repeat_task_templates` row creates the next occurrence via
  `src/utils/repeatSchedule.ts` (croner-backed, shared over `@src/`); the old
  Postgres trigger was dropped. `delete_task` also deletes a linked *scheduled*
  template so occurrences stop — a scheduleless one is a saved template the
  user may still stamp from, and survives.
- **Both halves of the one-open-task invariant live in
  `functions/mcp-server/tools/recurrence.ts`** (DEX-94) — see
  `docs/frontend.md` for the invariant. *Don't create a second:*
  `hasOpenTaskForTemplate` skips the spawn when another open task links to the
  template, and a failed lookup reads as "has one" (an extra chain is silent
  and permanent; a stalled repeat is surfaced and repairable). *Don't leave
  zero:* `create_template`/`update_template` seed a first occurrence,
  best-effort, never failing the template write. Deliberately not applied to
  `create_task`/`update_task`'s `templateId` — the app has the same gap, and
  Settings → Tasks flags a stalled repeat beside a one-tap repair.
- **A `repeat_task_templates` row with NULL `schedule` is a task template, not
  a repeat (DEX-65).** Nothing recurs from a scheduleless row, so one table
  serves both; switching between them is writing or clearing `schedule`. The
  column has **no default**, so every insert must state its schedule —
  `create_template` with `schedule` omitted creates a task template.
- **Subtasks are a jsonb array, not rows** (`tasks.subtasks`,
  `repeat_task_templates.subtasks`). The array buys: one level deep by
  construction; completing a parent sweeps its checklist in a single row
  update; no orphan-spawn hazard. Accepted tradeoffs and traps:
  - **Last-write-wins on the whole array** — concurrent editors clobber each
    other within a refetch window; the mitigation if ever needed is RPC array
    surgery, no schema change.
  - **Promotion is two non-atomic writes** (insert task, rewrite parent array);
    a crash between them leaves a duplicate, not data loss. A promoted subtask
    never inherits `alarm_time`.
  - **Write bounds are not read bounds** — `tools/helpers.ts` has bounded
    schemas for tool input and separate unbounded ones for parsing stored
    rows. Reusing the input schema on a read is a trap: a failed parse means
    "no subtasks", so an over-long stored title would silently skip the
    completion sweep.
  - **Every write path that can complete a task sweeps** — including
    `create_task` inserting an already-complete task.
- **`tasks.alarm_time`** (`time`, nullable, also on templates) — time-of-day a
  task's native iOS alarm fires; the app reconciles onto AlarmKit
  (`src/utils/alarms.ts`). A recurred occurrence copies the template's, so
  repeats keep their alarm.
- **`tasks.url`** (DEX-66) — deliberately unvalidated in the database and at
  the MCP boundary; the rule is `normalizeTaskUrl` (`src/utils/taskUrl.ts`,
  import-free so `mcp-server` applies the identical transform). Rejecting a
  malformed link would fail a write over an optional field. Templates have no
  counterpart for the same reason they have no `due_on`: a link belongs to the
  task, not the schedule that mints it.
- **`preferences.alarm_sound`** (DEX-72) — `text not null default 'echos'`,
  naming an entry in the app-owned `ALARM_SOUNDS` registry. Deliberately
  unconstrained: the list grows, and an unrecognized value falls back to the
  system sound rather than failing.

## Demo account login (App Store review)

Login is passwordless, so a reviewer can't receive a code out of band.
`verify-demo-otp` bridges the gap: demo email + fixed code (`DEMO_OTP`)
exchanges for a real session.

- **Identity is shared, not duplicated by drift** — `_shared/demoAuth.ts`
  exports `DEMO_EMAIL` (matched exactly, never a domain) and
  `deriveDemoPassword(otp)`; `seed-demo` sets the password to
  `deriveDemoPassword(DEMO_OTP)` and the function signs in with the same
  derived value, so the only shared secret is `DEMO_OTP`. The app re-declares
  `DEMO_EMAIL`/`isDemoEmail` in `src/hooks/useAuth.tsx` (it can't import the
  Deno module); keep them identical.
- **Publishable key, not service role** — one constant rejection for any bad
  input (can't probe accounts), then a normal `signInWithPassword`. Public and
  unthrottled, so `DEMO_OTP` must be **long and random**, not 6 digits; the
  login screen's demo path accepts a long non-numeric code.
- **The login email carries both a link and the code** —
  `templates/magic_link.html` renders `{{ .Token }}` alongside the link.
  `config.toml`'s template mapping only applies to the **local** stack; the
  hosted project's Magic Link template is dashboard-managed — paste the file
  into Authentication → Email Templates or production emails carry only the
  link. See `docs/appstore.md` for the reviewer flow.

## OAuth server (MCP authorization)

`mcp-server` validates bearer tokens but doesn't issue them — Supabase Auth's
built-in OAuth 2.1 server does (`[auth.oauth_server]` in `config.toml`, dynamic
registration off). The consent redirect goes to
`{site_url}/oauth/consent?authorization_id=…`, which is the Expo screen at
`src/app/oauth/consent.tsx` (approve/deny via `supabase.auth.oauth.*`; an
unauthenticated visitor is bounced to sign-in and returned). **`site_url` must
match the Expo web port** (8081 locally) or the redirect 404s.

Every client must be pre-registered with its exact redirect URI via the Auth
Admin OAuth API using the service-role key (Claude.ai/Desktop:
`https://claude.ai/api/mcp/auth_callback`; others per their docs). **Claude
Code** uses a dynamic loopback port, which a fixed redirect URI cannot match —
enabling dynamic registration for that flow is the open path before
advertising Claude Code support.

## Deployment (CI/CD)

Workflows live in `.github/workflows/` — read them there rather than here.
Facts that aren't visible from the YAML alone:

- **Migrations can apply out of timestamp order.** PRs merge in a different
  order than migrations were authored, which plain `supabase db push` refuses
  outright — so the deploy passes `--include-all`. The rule that falls out:
  **every migration must stand alone.** Never depend on a later-timestamped
  migration; prefer `IF EXISTS`/`IF NOT EXISTS`; if two must land in order,
  ship them in one PR.
- **A red test run does not block the production deploy** — `deploy.yml` has
  no dependency on the test workflows; tests gate PR merge only.
- **Preview branches need `preview-branch.yml`'s help**: Supabase deploys
  functions on branch creation but doesn't reliably redeploy on later pushes
  (an edited function 404s), and it never copies function secrets or seeds the
  demo account. Both jobs are idempotent.
- **`reset-demo.yml` reseeds the production demo account daily at 12:00 UTC.**
  Don't move it overnight: `seed-demo.ts` derives "today" from UTC, so a 03:00
  UTC run seeds tomorrow's dates for a US viewer (DEX-117). It keeps its own
  concurrency group — sharing `deploy.yml`'s would let a deploy evict the
  queued reseed and silently skip a day.

**Required GitHub repo secrets:** `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`,
`SUPABASE_ACCESS_TOKEN`, `DOTENV_PRIVATE_KEY_PREVIEW` (backend); `EXPO_TOKEN`,
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`EXPO_PUBLIC_SENTRY_DSN` (app/EAS).

## Secrets

Function secrets, referenced with `Deno.env.get(...)`:

| Secret                  | Used by                                   | Required?                                                                    |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| `DEMO_OTP`              | `verify-demo-otp`, `scripts/seed-demo.ts` | Required — the function 500s without it                                      |
| `SENTRY_DSN`            | every function                            | Optional — but `generate-horoscopes` has no other durable failure signal     |
| `ASTROLOGY_API_KEY`     | `generate-horoscopes`                     | Required — astrology-api.io bearer token; the name predates the vendor swap  |
| `HOROSCOPE_CRON_SECRET` | `generate-horoscopes`                     | Required — must equal the Vault `generate_horoscopes_secret`; rotate together |

### Preview-branch secrets (dotenvx)

Supabase's branching integration does **not** copy the parent project's
function secrets to a preview branch. Preview secrets come from the encrypted,
committed `supabase/.env.preview` (dotenvx), which the branching executor
decrypts and applies. `config.toml` `[edge_runtime.secrets]` maps each as
`KEY = "env(KEY)"`; add a secret with
`npx @dotenvx/dotenvx set NAME "value" -f supabase/.env.preview` and commit
both files — `__tests__/config/previewSecrets.test.ts` fails if they drift or
a value lands in plaintext. The decryption key is a production project secret
plus the `DOTENV_PRIVATE_KEY_PREVIEW` repo secret.

Three traps:

- **Export `DEMO_OTP` before a local `supabase start`** — an unresolved
  `env(...)` reference is not an error, so the local runtime can receive the
  literal string `env(DEMO_OTP)` as the secret.
- **`.env.keys` must sit next to `.env.preview`** — dotenvx reads the key from
  the `-f` file's directory but writes it to the *current* directory, so
  running `set` from the repo root drops `./.env.keys` in the wrong place and
  the next decrypt fails; move it to `supabase/.env.keys` (gitignored at any
  depth, but only the `supabase/` copy works).
- **`DEMO_OTP` and the seeded password rotate together** — the demo password
  is `deriveDemoPassword(DEMO_OTP)`, and `reset-demo.yml` reseeds production
  daily from `.env.preview`, making that file the effective source of truth
  for the production demo password. Setting a new `DEMO_OTP` function secret
  without re-encrypting `.env.preview` breaks review login and re-breaks it
  every morning while the workflow stays green.
