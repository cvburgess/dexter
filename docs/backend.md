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
- `functions/verify-demo-otp/` — signs the App Store demo account in with a
  fixed code (see "Demo account login" below)
- `functions/_shared/` — modules shared across functions (`sentry.ts`,
  `demoAuth.ts`)
- `templates/magic_link.html` — the passwordless login email (magic link +
  `{{ .Token }}` code), wired via `[auth.email.template.magic_link]` in
  `config.toml`
- `migrations/` — SQL migrations (timestamped filenames), including the
  production baseline
- `config.toml` — Local Supabase CLI configuration
- `seed.sql` — Optional seed data for local dev; the production baseline
  currently requires none
- `scripts/` — Operational Deno scripts. `seed-demo.ts` resets the App Store
  review / marketing demo account to a curated, known-good dataset (service
  role, idempotent); see [`../supabase/scripts/README.md`](../supabase/scripts/README.md)
  and [`appstore.md`](appstore.md)

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
  `template_id`, `repeat_task_templates.list_id`/`goal_id`,
  `daily_habits.habit_id`), the `WITH CHECK` clause should confirm the
  referenced row belongs to `auth.uid()` (`is null or exists (...)` for nullable
  FKs) so a user cannot attach another user's records.
- **A policy must never sub-select the table it guards.** Postgres re-applies
  the table's policies while evaluating the sub-select and raises
  `42P17 infinite recursion detected in policy` (see `DEX-4`/`DEX-32`). This
  bit the old `tasks.subtask_of` self-referential FK guard
  (`select 1 from public.tasks`). That column was dropped in DEX-70 — subtasks
  are now a jsonb array, not rows — so no self-referential FK exists in the
  schema today, and the rule stands as a constraint on any future one: the
  `USING` clause already restricts the operation to rows the caller owns, and a
  genuine cross-owner guard belongs in a `SECURITY DEFINER` helper (which
  bypasses RLS and so does not recurse), never an inline sub-select.
  `supabase/__tests__/migrations/tasks_update_rls.test.ts` pins this.

## Realtime

All eight user-owned tables (`tasks`, `repeat_task_templates`, `lists`,
`goals`, `habits`, `daily_habits`, `days`, `preferences`) are added to the
`supabase_realtime` publication via a guarded migration
(`20260717193451_realtime_publication.sql`), so Postgres emits change events
for them. Publication membership is **migration-managed** — do not add/remove
tables via the dashboard, since a later migration re-adding an already-present
table would no-op (the guard checks `pg_publication_tables`), but a
dashboard-only addition would drift from what the migration declares.

- **RLS gates delivery**: Realtime evaluates `postgres_changes` subscriptions
  through the same RLS policies as normal queries, so a client only receives
  events for rows it could `SELECT`. No separate realtime-specific
  authorization exists.
- **DELETE events are not filterable** by column (a Postgres/Realtime
  limitation, not specific to this schema): with default `REPLICA IDENTITY`,
  a DELETE's `old` record contains only primary-key columns, so a filter on
  any other column — including the `user_id=eq.<uuid>` filter the client
  applies — can never match. Only `days` and `preferences` key on `user_id`;
  for the other six tables (`tasks`, `goals`, `lists`, `habits`,
  `daily_habits`, `repeat_task_templates`), this means DELETE-triggered
  realtime invalidation **never fires, by construction** — not an occasional
  miss, a structural gap for every deletion on those tables.
- **Client contract: invalidation-only.** The app's realtime consumer
  (`useRealtimeInvalidation`, see `docs/frontend.md`) never reads event
  payloads as data — an event only triggers a query-cache invalidation, and
  the subsequent refetch goes through the normal RLS-scoped REST path. This
  sidesteps the PK-only old-record limitation (there's no payload data to be
  wrong), but does not change the DELETE-filter gap above: a deleted row on
  those six tables persists on screen until the next focus/staleness-
  triggered refetch (`DEFAULT_STALE_TIME_MS`), not until the next event.

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
  gateway so it can validate bearer tokens inline. It creates a publishable-key
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
- **Task status is shared, not mirrored.** `src/utils/taskStatus.ts` holds
  `ETaskStatus` and `isCompletionStatus` and is imported by the app, by
  `mcp-server`, and by `scripts/demoData.ts` over the `@src/` alias, so a new
  status can't be added to one side and forgotten on the other. It must stay import-free — Deno requires explicit
  `.ts` extensions on relative imports while Metro/tsc forbid them, which is why
  the enum can't simply live in `src/api/tasks.ts` (that file pulls in
  `@supabase/supabase-js`). The values are persisted as `tasks.status smallint`
  with no Postgres enum or check constraint, so `taskStatusSchema`
  (`z.nativeEnum(ETaskStatus)`) is the only thing rejecting a bogus status.
  Terminal statuses are done, won't do, and delegated.
- **Repeat tasks are recurred in TypeScript, not Postgres.** Completing a task
  linked to a `repeat_task_templates` row (status → any terminal status) creates
  the next occurrence, with its date computed by `src/utils/repeatSchedule.ts`
  (croner-backed) — imported by both the app and `mcp-server` (via the `@src/`
  alias in `functions/mcp-server/deno.json`). The legacy
  `create_next_recurring_task` trigger was dropped (migration
  `20260712142149_drop_recurring_task_trigger.sql`); `update_task`/`archive_task`
  invoke the shared logic, and `delete_task` also deletes a linked template so
  future occurrences stop. A recurred occurrence copies the template's
  `alarm_time` (see below) so repeat tasks keep their alarm.
- **Subtasks are a jsonb array, not rows (`subtasks`).** `tasks` and
  `repeat_task_templates` each carry `subtasks jsonb NOT NULL DEFAULT '[]'`
  (migration `20260721182025_add_task_subtasks.sql`). A subtask is a
  lightweight checklist item — `{id, title, status}` on a task, `{id, title}`
  on a template, with ids minted client-side and unique only within their own
  array. Choosing the array over the relational `tasks.subtask_of` column
  (dropped by the same migration, and never app-writable) buys three things:
  subtasks are one level deep by construction; completing a parent sweeps its
  whole checklist in a **single row update**, so a done parent is never stored
  alongside open children; and recurrence has no orphan-spawn hazard, because
  array items carry no `template_id`. It needs no RLS change — subtasks live
  inside rows the existing `user_id` policies already guard — and no triggers.
  - **Accepted tradeoff: last-write-wins on the whole array.** The phone and an
    MCP client editing the same checklist inside one refetch window will clobber
    each other. Whole-array replacement is the contract everywhere (the MCP
    `update_task` tool documents it explicitly). If this becomes a real problem,
    the mitigation is RPC array surgery — `subtask_add` / `subtask_set_status` /
    `subtask_promote` — which needs **no schema change**.
  - **Promotion is two non-atomic writes.** A subtask graduating to a real task
    inherits the parent's `list_id`/`goal_id`/`priority`/`scheduled_for`/
    `due_on` but never its `alarm_time`; the task is inserted, then the parent's
    array is rewritten without it. A crash between the two leaves a duplicate,
    not data loss.
  - **Write bounds are not read bounds.** `tools/helpers.ts` exports bounded
    schemas for tool *input* (`subtasksSchema`, `templateSubtasksSchema` — 100
    items, 100-char titles) and separate unbounded ones for parsing *stored*
    rows (`storedSubtasksSchema`, `storedTemplateSubtasksSchema`). Reusing the
    input schema on a read is a trap: a failed parse means "no subtasks", so an
    over-long stored title would silently skip that task's completion sweep
    instead of rejecting anything. The app caps input at
    `SUBTASK_TITLE_MAX_LENGTH` to match the write bound.
  - **Every write path that can complete a task sweeps.** `update_task` and
    `archive_task` fold the sweep into their existing pre-update read
    (`readForCompletion`), and `create_task` sweeps when it inserts an
    already-complete task — otherwise the forbidden state could be created
    directly, sidestepping both.
  - If subtasks ever need fields of their own, that is a jsonb→rows migration.
- **Task alarms (`alarm_time`).** `tasks` and `repeat_task_templates` each carry
  a nullable `alarm_time` (`time`) column (migration
  `20260717230155_add_task_alarm_time.sql`). It stores the time-of-day a task's
  native iOS alarm fires, combined with `scheduled_for` for the date; the app
  reconciles these onto AlarmKit (`src/utils/alarms.ts`, iOS-only). The column
  needs no RLS change — the existing `user_id` policies cover it — and both
  tables are already in the realtime publication, so alarm edits sync like any
  other field.
- **Alarm sound (`preferences.alarm_sound`).** Which sound those alarms ring
  with, as a `text not null default 'echos'` column on `preferences` (migration
  `20260726193509_add_preferences_alarm_sound.sql`, DEX-72). The value names an
  entry in the app's `ALARM_SOUNDS` registry (`src/utils/alarms.shared.ts`), not
  a file path — the audio is bundled into the iOS app at prebuild, so the DB only
  records the choice, and `'system'` means "leave AlarmKit on its default sound".
  Deliberately unconstrained text: the sound list is app-owned and expected to
  grow, and a client that doesn't recognize a stored value falls back to the
  system sound rather than failing. Defaulting to `'echos'` is what gives
  existing rows Dexter's sound without a backfill.
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

## Demo account login (App Store review)

The app's login is passwordless (email magic link / OTP code + Google), so an
App Store reviewer can't receive a code out of band. `verify-demo-otp` bridges
that gap: the reviewer enters the demo email and a fixed code (`DEMO_OTP`), and
the function exchanges them for a real session.

- **Identity is shared, not duplicated by drift.** `functions/_shared/demoAuth.ts`
  exports `DEMO_EMAIL` (matched *exactly* — never a whole domain — so a real
  user can never be routed through the bypass) and `deriveDemoPassword(otp)`.
  The `seed-demo` script sets the demo user's password to
  `deriveDemoPassword(DEMO_OTP)`; the function signs in with the same derived
  value. So the only shared secret is `DEMO_OTP` — no password is stored or
  shipped in the app. The app re-declares `DEMO_EMAIL`/`isDemoEmail` in
  `src/hooks/useAuth.tsx` (it can't import the Deno module); keep them identical.
- **The function uses the publishable key, not the service role.** It validates
  `isDemoEmail(email) && token === DEMO_OTP` (one constant rejection for any bad
  input, so it can't be used to probe accounts), then calls
  `signInWithPassword` — a normal auth call — and returns the session. This
  keeps `verify-demo-otp` from widening backend privileges even though it's
  public (`verify_jwt = false`, since it mints the session). If the demo user or
  password is missing (the seed script hasn't run, or `DEMO_OTP` changed since),
  it returns a distinct "not ready" error.
- **The login email carries both a link and the code.** `signInWithOtp` (with
  `emailRedirectTo`) still sends the magic link, and `templates/magic_link.html`
  renders `{{ .Token }}` alongside `{{ .ConfirmationURL }}`, so real users can
  tap the link or type the code on the login screen's code-entry step
  (`verifyOtp({ type: "email" })`). See `docs/frontend.md` (Auth) and
  `docs/appstore.md` for the reviewer flow.
- **Required secret:** `DEMO_OTP` (set as a function secret and passed to the
  seed script). `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEYS` are already present.
  Because the endpoint is public and unthrottled, use a **long, random**
  `DEMO_OTP` (not a 6-digit number) so the demo account can't be brute-forced —
  the login screen lets the demo code entry accept a long non-numeric secret,
  unlike the 6-digit field real users see. Rotate or disable the function after
  review if desired; it only ever reaches the demo account's data.
- **Deploying the email template:** `[auth.email.template.magic_link]` in
  `config.toml` only applies to the **local** `supabase start` stack. The hosted
  project's Magic Link template is dashboard-managed — paste
  `templates/magic_link.html` into Authentication → Email Templates → Magic Link
  so production emails carry the `{{ .Token }}` code, not just the link.

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
- **`preview-branch.yml`** — fills the gaps Supabase's native branching leaves
  on a PR's preview branch. A `resolve` job gates on the `Supabase Preview`
  check reporting success (so it never fires on a PR without a preview),
  resolves the branch's `project_ref`, and hands it to two parallel jobs:
  `deploy-functions` redeploys edge functions (Supabase deploys them on branch
  creation but doesn't reliably redeploy on later pushes, so a function edited
  afterward 404s), and `seed-demo` runs `supabase/scripts/seed-demo.ts` against
  the branch with its own service-role key so the demo account exists. Both are
  idempotent and safe to re-run on every push; `workflow_dispatch` with a
  `git_branch` input targets an existing preview branch on demand.
- **`preview.yml`** — `workflow_dispatch` EAS preview OTA update (`eas update
  --auto`) that comments on the PR.

EAS deploys/updates rely on **EAS Update** wiring in `src/`: the `export:web`
script (`expo export --platform web`), the `expo-updates` dependency, and the
`updates.url` + `runtimeVersion` config in `src/app.json`.

**Required GitHub repo secrets:** `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`,
`SUPABASE_ACCESS_TOKEN`, `DOTENV_PRIVATE_KEY_PREVIEW` (backend); `EXPO_TOKEN`,
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`EXPO_PUBLIC_SENTRY_DSN` (app/EAS).

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

| Secret       | Used by                                   | Required?                                              |
| ------------ | ----------------------------------------- | ------------------------------------------------------ |
| `DEMO_OTP`   | `verify-demo-otp`, `scripts/seed-demo.ts` | Required for demo login — the function 500s without it |
| `SENTRY_DSN` | `mcp-server`, `ics-proxy`                 | Optional — Sentry reporting no-ops gracefully if unset |

### Preview-branch secrets (dotenvx)

Supabase's branching integration copies migrations and redeploys functions to a
preview branch but **does not copy the parent project's function secrets** — a
fresh preview had no `DEMO_OTP`, so `verify-demo-otp` returned "Demo login is
not configured". Preview secrets are managed with
[dotenvx](https://dotenvx.com/) instead: an encrypted `supabase/.env.preview` is
committed to the repo, and the branching executor decrypts it and applies the
values to every new branch.

- `supabase/.env.preview` holds encrypted values (safe to commit).
- [`supabase/config.toml`](../supabase/config.toml) `[edge_runtime.secrets]`
  maps each secret as `KEY = "env(KEY)"`. Because it's `env(...)` indirection,
  a local `supabase start` reads the value from your shell environment — same
  convention as the existing `env(SUPABASE_AUTH_GOOGLE_SECRET)`. **Export
  `DEMO_OTP` before `supabase start`**: an unresolved `env(...)` reference is
  not an error, so the local Edge Runtime can receive the literal string
  `env(DEMO_OTP)` as the secret rather than `verify-demo-otp` reporting "not
  configured". Hosted projects are unaffected — production sets the secret
  directly, and previews get it from `.env.preview`.
- The decryption key is stored as a Supabase **project** secret on production,
  uploaded once with
  `npx supabase secrets set --env-file supabase/.env.keys --project-ref <parent_ref>`,
  and as the `DOTENV_PRIVATE_KEY_PREVIEW` GitHub repo secret so
  `preview-branch.yml` can decrypt in CI.

Add or update a secret:

```bash
npx @dotenvx/dotenvx set SECRET_NAME "value" -f supabase/.env.preview
```

Add the matching `KEY = "env(KEY)"` to `config.toml` and commit both files —
`supabase/__tests__/config/previewSecrets.test.ts` fails if the two drift or if
a value is committed in plaintext. Re-upload `.env.keys` if the decryption key
rotates.

> **`.env.keys` must sit next to `.env.preview`** — dotenvx *reads* the key
> from the `-f` file's own directory (`supabase/`), but *writes* it to whatever
> directory you ran the command in. Running `set` from the repo root therefore
> drops `./.env.keys` in the wrong place, and the next decrypt fails with
> `[DECRYPTION_FAILED]`; move it to `supabase/.env.keys`. `.gitignore` matches
> the filename at any depth, so it stays uncommitted either way — but only the
> `supabase/` copy actually works.

> **`DEMO_OTP` and the seeded password rotate together.** The demo user's
> password is `deriveDemoPassword(DEMO_OTP)`, so changing `DEMO_OTP` requires
> re-encrypting `.env.preview` **and** re-running `seed-demo` against every
> project that holds a demo account, or login breaks. Preview branches
> deliberately reuse production's `DEMO_OTP` so App Store review and preview
> behave identically; the tradeoff is that the production demo credential lives
> encrypted in git, decryptable by anything holding the preview private key.

See the
[Supabase branching docs](https://supabase.com/docs/guides/deployment/branching/configuration#using-dotenvx-for-git-based-workflow)
for details.
