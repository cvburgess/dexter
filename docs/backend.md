# Backend (`/supabase`)

The Dexter backend is hosted on [Supabase](https://supabase.com/docs):
PostgreSQL (with RLS), Auth, and **Edge Functions** (Deno/TypeScript). Config,
functions, and migrations live under `/supabase`; commands are in `AGENTS.md`.
For query optimization, schema design, and RLS guidance, load the
`supabase-postgres-best-practices` skill before touching the database.

This doc holds the rules that apply to **any** table, migration, or function.
What a particular table stores is `docs/features.md`; what a particular endpoint
promises is `docs/api-routes.md`.

## Schema conventions

- **A new column on a user-owned table needs no RLS change** — the existing
  `user_id` policies cover it. Only new tables and new access patterns need policy
  work.
- **Grants must be stated explicitly on any new table.** Default privileges on
  this stack grant no DML to `anon`/`authenticated`/`service_role`; the baseline's
  `grant all` was a one-time snapshot. `service_role` does **not** get INSERT for
  free — BYPASSRLS exempts a role from policies, not grants. Check
  `\dp public.<table>` rather than assuming.
- **Enums only for genuinely closed sets.** `sun_sign`, `horoscope_sentiment`,
  and `focus_block_status` qualify — a focus block is running, held, finished, or
  abandoned, and there is no fifth thing. `tasks.status`,
  `preferences.alarm_sound`, and `preferences.focus_block_minutes` stay
  unconstrained on purpose — those lists grow, and enum values can never be
  removed. A third enum does **not** reopen that; an unconstrained value means
  the zod schemas are the only rejection of a bogus one.
- **Generated columns need an IMMUTABLE expression** — a string literal cast to an
  enum qualifies, a `now()` would not. A user-defined function qualifies too if
  declared `immutable` (a `SET search_path` clause does not disqualify it), which
  is worth reaching for once the expression repeats itself — but **Postgres
  records no dependency on that function's body**. `create or replace` on it
  recomputes nothing, leaving stored rows no expression in the schema produces.
  Changing such a rule means dropping and re-adding the column, which rewrites
  the table and thereby backfills it (`20260817143500`). Note also that
  `alter column ... set expression` is Postgres 17 and `config.toml` pins 15.

## RLS policy invariants

Every user-owned table enables RLS with per-operation policies keyed on
`auth.uid() = user_id`. Invariants for every table:

- **UPDATE policies must constrain `WITH CHECK`, not just `USING`.** `USING` gates
  the pre-update row, `WITH CHECK` the post-update row; `with check (true)` lets a
  user reassign `user_id` to someone else.
- **Tenant-scoped foreign keys must reference rows the caller owns** — the
  `WITH CHECK` confirms the referenced row belongs to `auth.uid()`
  (`is null or exists (...)` for nullable FKs).
- **A policy must never sub-select the table it guards** — Postgres re-applies the
  policies inside the sub-select and raises `42P17 infinite recursion` (DEX-4/
  DEX-32, via the since-dropped `tasks.subtask_of` guard). A genuine cross-owner
  guard belongs in a `SECURITY DEFINER` helper, never an inline sub-select.

## Realtime

All ten user-owned tables are in the `supabase_realtime` publication via guarded
migrations. Membership is **migration-managed** — a dashboard-only addition would
drift from what the migrations declare. Dropping a table drops it from every
publication automatically.

- **RLS gates delivery** — a client only receives events for rows it could
  `SELECT`; there is no separate realtime authorization.
- **DELETE events are not filterable by column** (default `REPLICA IDENTITY` puts
  only PK columns in the `old` record). Only `notes`/`journals`/`preferences` key
  on `user_id`, so for the other six tables the client's `user_id=eq.<uuid>` filter
  can never match a DELETE — deletion-triggered invalidation **never fires there,
  by construction**. Keeping `user_id` in a PK is therefore a deliberate schema
  choice (`(user_id, date)` on notes/journals also lets the PK index serve every
  user-scoped lookup).
- **Client contract: invalidation-only.** `useRealtimeInvalidation` (see
  `docs/frontend.md`) never reads event payloads as data — an event triggers a
  cache invalidation and the refetch goes through the normal RLS-scoped REST path.
  A deleted row on the six tables above persists on screen until the next
  focus/staleness refetch, not the next event.

## Edge Functions

Runtime is **Deno**, not Node; prefer JSR / `npm:` specifiers as in each
function's `deno.json`. Each function's own contract — auth model, secrets, and
why its `verify_jwt` is set the way it is — is in `docs/api-routes.md`.

All functions report to **Sentry** via `functions/_shared/sentry.ts` — graceful
no-ops when `SENTRY_DSN` is unset, `withSentry`-wrapped handlers, and every MCP
`toolError(...)` also reports. Triage with the `/triage-sentry` skill.

### Code shared with the app

- **Task status/priority enums are shared, not mirrored.**
  `src/utils/taskStatus.ts` / `taskPriority.ts` are imported by the app,
  `mcp-server`, and `scripts/demoData.ts` over the `@src/` alias, and must stay
  **import-free** (Deno requires `.ts` extensions on relative imports; Metro/tsc
  forbid them — which is why the enums can't live in `src/api/tasks.ts`, which
  re-exports them). Lower priority is *more* urgent; `UNPRIORITIZED` (4) means
  "never chosen".
- The same import-free rule carries `src/utils/repeatSchedule.ts` (recurrence) and
  `src/utils/taskUrl.ts` (link normalization) — both applied identically by the app
  and `mcp-server`.

## Deployment (CI/CD)

Workflows live in `.github/workflows/` — read them there rather than here. Facts
that aren't visible from the YAML alone:

- **Migrations can apply out of timestamp order.** PRs merge in a different order
  than migrations were authored, which plain `supabase db push` refuses outright —
  so the deploy passes `--include-all`. The rule that falls out: **every migration
  must stand alone.** Never depend on a later-timestamped migration; prefer
  `IF EXISTS`/`IF NOT EXISTS`; if two must land in order, ship them in one PR.
- **A red test run does not block the production deploy** — `deploy.yml` has no
  dependency on the test workflows; tests gate PR merge only.
- **Preview branches need `preview-branch.yml`'s help**: Supabase deploys functions
  on branch creation but doesn't reliably redeploy on later pushes (an edited
  function 404s), and it never copies function secrets or seeds the demo account.
  Both jobs are idempotent.
- **`reset-demo.yml` reseeds the production demo account daily at 12:00 UTC.**
  Don't move it overnight: `seed-demo.ts` derives "today" from UTC, so a 03:00 UTC
  run seeds tomorrow's dates for a US viewer (DEX-117). It keeps its own
  concurrency group — sharing `deploy.yml`'s would let a deploy evict the queued
  reseed and silently skip a day.

## Secrets

Function secrets, referenced with `Deno.env.get(...)`:

| Secret                  | Used by                                   | Required?                                                                    |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| `DEMO_OTP`              | `verify-demo-otp`, `scripts/seed-demo.ts` | Required — the function 500s without it                                      |
| `SENTRY_DSN`            | every function                            | Optional — but `generate-horoscopes` has no other durable failure signal     |
| `ASTROLOGY_API_KEY`     | `generate-horoscopes`                     | Required — astrology-api.io bearer token; the name predates the vendor swap  |
| `HOROSCOPE_CRON_SECRET` | `generate-horoscopes`                     | Required — must equal the Vault `generate_horoscopes_secret`; rotate together |

### Preview-branch secrets (dotenvx)

Supabase's branching integration does **not** copy the parent project's function
secrets to a preview branch. Preview secrets come from the encrypted, committed
`supabase/.env.preview` (dotenvx), which the branching executor decrypts and
applies. `config.toml` `[edge_runtime.secrets]` maps each as `KEY = "env(KEY)"`;
add a secret with
`npx @dotenvx/dotenvx set NAME "value" -f supabase/.env.preview` and commit both
files — `__tests__/config/previewSecrets.test.ts` fails if they drift or a value
lands in plaintext. The decryption key is a production project secret plus the
`DOTENV_PRIVATE_KEY_PREVIEW` repo secret.

Three traps:

- **Export `DEMO_OTP` before a local `supabase start`** — an unresolved `env(...)`
  reference is not an error, so the local runtime can receive the literal string
  `env(DEMO_OTP)` as the secret.
- **`.env.keys` must sit next to `.env.preview`** — dotenvx reads the key from the
  `-f` file's directory but writes it to the *current* directory, so running `set`
  from the repo root drops `./.env.keys` in the wrong place and the next decrypt
  fails; move it to `supabase/.env.keys` (gitignored at any depth, but only the
  `supabase/` copy works).
- **`DEMO_OTP` and the seeded password rotate together** — the demo password is
  `deriveDemoPassword(DEMO_OTP)`, and `reset-demo.yml` reseeds production daily
  from `.env.preview`, making that file the effective source of truth for the
  production demo password. Setting a new `DEMO_OTP` function secret without
  re-encrypting `.env.preview` breaks review login and re-breaks it every morning
  while the workflow stays green.
