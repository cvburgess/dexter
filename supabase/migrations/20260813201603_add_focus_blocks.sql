-- DEX-49: Focus blocks — the Pomodoro-style timer a task is worked under.
--
-- One row per timer a user starts. Always tied to a task (`task_id` is NOT
-- NULL): a block is started in one tap from a task card's menu, so there is no
-- such thing as an unattached block and nothing in the app can create one.
--
-- **The clock is stored as an anchor, not as ticks.** `remaining_seconds` is a
-- snapshot taken at the last pause, and `resumed_at` is when the current run
-- began; live remaining is `remaining_seconds - (now() - resumed_at)`, computed
-- by the client on every frame it draws. The alternative — writing the countdown
-- down each second — would be ~1,500 UPDATEs per 25-minute block per user, every
-- one replicated to `supabase_realtime` and invalidating a query cache, to store
-- a number that is a subtraction away. This table is written at most five times
-- in a block's life: start, pause, resume, and whichever of finish/cancel ends
-- it. It is also what makes cross-device sync (DEX-155) cheap later — every
-- device derives the same remaining time from the same row.
--
-- Shape notes:
-- * `date` is the **local** calendar day the block belongs to, supplied by the
--   client, exactly like `notes.date` and `journals.date`. `created_at` cannot
--   substitute: it is a UTC instant, so a block started at 22:00 in UTC-8 lands
--   on the following UTC day and would be counted by the wrong evening ritual.
--   It is stamped once at start and never moved, so a block running past
--   midnight still belongs to the day it was begun on.
-- * Durations are seconds, not minutes, even though the length comes from a
--   whole-minute preference: pausing lands mid-minute, and a minute-granular
--   snapshot would silently round every pause longer or shorter. (A deliberate
--   rename from the issue's `total_duration`/`remaining_duration`, which do not
--   state a unit for a number two clients do arithmetic on.)
-- * Deliberately no `updated_at` and no `archived_at` (a deviation from the
--   create-migration skill's new-table template): nothing in this schema
--   maintains an `updated_at` today (see 20260726215745), and `status` already
--   carries every end state a block has, so a soft-delete column would be a
--   second, contradictory way to say "cancelled".
--
-- `status` is this schema's third enum, and it earns one on the same test
-- `sun_sign` and `horoscope_sentiment` passed (docs/backend.md, "Enums only for
-- genuinely closed sets"): a block is running, held, finished, or abandoned, and
-- there is no fifth thing it can be. This does **not** reopen `tasks.status`,
-- which stays an unconstrained smallint on purpose because that list is
-- app-owned and grows.
--
-- `complete` and `cancelled` are separate values and the distinction is
-- load-bearing: the evening ritual's Review step counts `complete` only, so
-- stopping a block early is recorded honestly without inflating the day's
-- figure.
--
-- Rollback:
--   drop table if exists public.focus_blocks;
--   drop type if exists public.focus_block_status;
-- (Dropping a table also removes it from every publication, so no separate
-- `alter publication ... drop table` is needed — and one afterwards would fail
-- on the now-missing relation.)

-- `create type` has no IF NOT EXISTS. `to_regtype` returns NULL rather than
-- raising for an unknown type, which is what makes this replay-safe under
-- `db push --include-all` (same guard as 20260804005118_add_horoscopes.sql).
do $$
begin
  if to_regtype('public.focus_block_status') is null then
    -- Declared in lifecycle order, so `order by status` reads as the sequence a
    -- block moves through rather than alphabetically.
    create type public.focus_block_status as enum (
      'active',
      'paused',
      'complete',
      'cancelled'
    );
  end if;
end $$;

create table if not exists public.focus_blocks (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on update cascade on delete cascade,
  -- ON DELETE CASCADE, not SET NULL: `task_id` is NOT NULL because a block
  -- without a task has no meaning, so deleting a task takes its blocks with it.
  -- The visible consequence is that deleting a task retroactively lowers a past
  -- day's focus-block count. Accepted — the alternative is orphan rows counting
  -- toward a figure whose subject no longer exists. Same shape as
  -- daily_habits.habit_id.
  task_id uuid not null
    references public.tasks(id) on update cascade on delete cascade,
  date date not null,
  status public.focus_block_status not null default 'active',
  total_seconds integer not null,
  remaining_seconds integer not null,
  resumed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (id),
  constraint focus_blocks_total_seconds_positive
    check (total_seconds > 0),
  constraint focus_blocks_remaining_seconds_in_range
    check (remaining_seconds >= 0 and remaining_seconds <= total_seconds),
  -- The anchor invariant, stated in the database rather than trusted to every
  -- writer: a running block has a `resumed_at` to count down from, and nothing
  -- else may carry one. Without it, a paused row holding a stale `resumed_at`
  -- reads as still running to any client deriving remaining time the documented
  -- way — including a psql session or dashboard edit, which bypass the app's and
  -- MCP's validation entirely (same reasoning as tasks.subtasks, 20260721182025).
  constraint focus_blocks_resumed_at_iff_active
    check ((status = 'active') = (resumed_at is not null))
);

comment on table public.focus_blocks is
  'DEX-49: one Pomodoro-style timer per row, always tied to a task. Stores an anchor (remaining_seconds + resumed_at) rather than per-second ticks; clients derive live remaining time. `date` is the local day the block belongs to, which is what the ritual Review step counts by.';

alter table public.focus_blocks enable row level security;

-- Four per-command ownership policies, the shape every user-owned table in this
-- schema uses. `auth.uid()` stays wrapped in a SELECT subquery so the planner
-- caches it as an initplan instead of re-evaluating it per row (docs/backend.md,
-- "RLS policy invariants").
--
-- INSERT and UPDATE additionally prove that `task_id` references a task the
-- caller owns. `task_id` is NOT NULL, so there is no null guard — exactly the
-- daily_habits/habit_id pair in 20260708040856. Note this table gets the check
-- on **INSERT as well as UPDATE**: DEX-4 fixed only the UPDATE side across the
-- existing tables and explicitly left the INSERT gap for later, and there is no
-- reason to reproduce that gap in a table written from scratch. Sub-selecting
-- `public.tasks` is safe — the forbidden thing is a policy sub-selecting the
-- table it guards, which recurses (42P17, DEX-4/DEX-32).

drop policy if exists "Users can select their own focus blocks" on "public"."focus_blocks";
create policy "Users can select their own focus blocks" on "public"."focus_blocks"
  as permissive
  for select
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

drop policy if exists "Users can insert their own focus blocks" on "public"."focus_blocks";
create policy "Users can insert their own focus blocks" on "public"."focus_blocks"
  as permissive
  for insert
  to "authenticated"
  with check (
    ((( SELECT auth.uid() AS uid) = user_id)
    AND (EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.user_id = ( SELECT auth.uid() AS uid))))
  );

drop policy if exists "Users can update their own focus blocks" on "public"."focus_blocks";
create policy "Users can update their own focus blocks" on "public"."focus_blocks"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check (
    ((( SELECT auth.uid() AS uid) = user_id)
    AND (EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.user_id = ( SELECT auth.uid() AS uid))))
  );

drop policy if exists "Users can delete their own focus blocks" on "public"."focus_blocks";
create policy "Users can delete their own focus blocks" on "public"."focus_blocks"
  as permissive
  for delete
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

-- The RLS predicate's index and the FK's. No `(user_id, date)` composite: the
-- ritual's per-day read is the only date-filtered query, a heavy user generates a
-- handful of rows a day, and a speculative index on a table this small costs more
-- to maintain than the scan it would replace. If that changes, `(user_id, date)`
-- supersedes idx_focus_blocks_user_id by the leftmost-prefix rule rather than
-- joining it.
create index if not exists idx_focus_blocks_user_id
  on public.focus_blocks using btree (user_id);
create index if not exists idx_focus_blocks_task_id
  on public.focus_blocks using btree (task_id);

-- **At most one live block per user, enforced here rather than in the client.**
-- The whole UI — the tab-bar accessory, the timer bar, the menu row that appears
-- and disappears — is written against "there is one running block or none", and
-- the query behind it reads a single row. Two devices starting a block without
-- seeing each other is exactly the case the app cannot detect, and a partial
-- unique index turns it into a rejected insert (23505) instead of a second,
-- invisible timer draining in the background. Cross-device *sync* of a running
-- block is deliberately out of scope for DEX-49 (DEX-155); cross-device
-- *corruption* is not something to leave open in the meantime.
create unique index if not exists idx_focus_blocks_one_live_per_user
  on public.focus_blocks using btree (user_id)
  where (status in ('active', 'paused'));

-- Grants are stated explicitly rather than inherited: default privileges on this
-- stack grant no DML to anon/authenticated/service_role, and the baseline's
-- `grant all on all tables` was a one-time snapshot that does not reach tables
-- created afterwards (docs/backend.md, "Schema conventions").
--
-- No `service_role` grant, unlike horoscopes: nothing server-side writes focus
-- blocks. The MCP server runs every query under the caller's own JWT, so it is
-- covered by the `authenticated` grants.
revoke all on public.focus_blocks from anon, authenticated;
grant select, insert, update, delete on public.focus_blocks to authenticated;

-- Emit change events for client cache invalidation, same guarded pattern as
-- 20260717193451_realtime_publication.sql.
--
-- Note the DELETE caveat from docs/backend.md, "Realtime": the PK is `id` alone,
-- so the default REPLICA IDENTITY puts no `user_id` in a DELETE's `old` record
-- and the client's `user_id=eq.<uuid>` filter can never match one. That costs
-- nothing here — the app never deletes a block, it ends one with an UPDATE to
-- `complete`/`cancelled`, which is filterable.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array['focus_blocks'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
