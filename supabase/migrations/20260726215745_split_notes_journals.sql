-- DEX-51: Split notes and journal entries out of public.days.
--
-- Notes and the journal were never two tables — they were two columns on one
-- `days` row (`notes text`, `prompts jsonb`), keyed (date, user_id). That single
-- shared row forced coupling on every client: a note-only write had to preserve
-- the sibling `prompts` column (and seed it, so a legacy client would not render
-- a blank journal — see 20260713003945_days_prompts_not_null_default.sql), the
-- journal had to rewrite its whole array to preserve `notes`, and one MCP tool
-- pair wrote both features at once. Two tables dissolve that class of problem.
--
-- Shape notes:
-- * PK is (user_id, date) rather than the legacy (date, user_id). Leading with
--   `user_id` means the PK index already serves every user-scoped lookup, so no
--   separate idx_*_user_id is needed, and keeping `user_id` in the PK keeps
--   DELETE realtime events filterable (default REPLICA IDENTITY ships PK
--   columns only — see docs/backend.md "Realtime").
-- * Deliberately no `id`/`updated_at`/`archived_at` (a deviation from the
--   create-migration skill's new-table template): one row per user per date is
--   the domain invariant here — same as `days` and `preferences` — and nothing
--   in this schema maintains an `updated_at` today, so adding one would ship a
--   column guaranteed to be stale.
--
-- `public.days` is intentionally left in place and untouched: it is the backfill
-- source, the rollback path, and what already-released legacy dexter-app builds
-- still read. Dropping it is a separate migration, after a dexter-app release
-- that reads the new tables has shipped.
--
-- Rollback: the new tables can be dropped outright — `days` still holds every
-- backfilled row, and this migration never writes to it. Dropping a table also
-- removes it from every publication, so the two statements below are all that is
-- needed (an `alter publication ... drop table` afterwards would fail on the
-- now-missing relation).
--   drop table if exists public.notes;
--   drop table if exists public.journals;
-- (Any note/journal written *after* this migration exists only in the new
-- tables, so a rollback loses those edits.)

create table if not exists public.notes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table if not exists public.journals (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  prompts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- Every reader treats `prompts` as an array of {prompt, response} without
-- type-guarding, and `jsonb` alone permits an object, string, or number. Same
-- reasoning as tasks.subtasks (20260721182025): enforce the array shape in the
-- database rather than trusting each writer, since a psql session or dashboard
-- edit bypasses the app's and MCP's validation.
alter table public.journals
  drop constraint if exists journals_prompts_is_array;
alter table public.journals
  add constraint journals_prompts_is_array
  check (jsonb_typeof(prompts) = 'array');

alter table public.notes enable row level security;
alter table public.journals enable row level security;

-- Ownership-only policies, mirroring the existing `days` policies. UPDATE
-- constrains `with check` as well as `using` (never `with check (true)`, which
-- the baseline used and 20260708040856 fixed) so a user cannot reassign
-- `user_id` to another account. `auth.uid()` stays wrapped in a SELECT
-- subquery so the planner caches it as an initplan instead of re-evaluating it
-- per row (docs/backend.md "RLS policy invariants").

drop policy if exists "Users can delete their own notes" on "public"."notes";
create policy "Users can delete their own notes" on "public"."notes"
  as permissive
  for delete
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

drop policy if exists "Users can insert their own notes" on "public"."notes";
create policy "Users can insert their own notes" on "public"."notes"
  as permissive
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

drop policy if exists "Users can select their own notes" on "public"."notes";
create policy "Users can select their own notes" on "public"."notes"
  as permissive
  for select
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

drop policy if exists "Users can update their own notes" on "public"."notes";
create policy "Users can update their own notes" on "public"."notes"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

drop policy if exists "Users can delete their own journals" on "public"."journals";
create policy "Users can delete their own journals" on "public"."journals"
  as permissive
  for delete
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

drop policy if exists "Users can insert their own journals" on "public"."journals";
create policy "Users can insert their own journals" on "public"."journals"
  as permissive
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

drop policy if exists "Users can select their own journals" on "public"."journals";
create policy "Users can select their own journals" on "public"."journals"
  as permissive
  for select
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

drop policy if exists "Users can update their own journals" on "public"."journals";
create policy "Users can update their own journals" on "public"."journals"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

-- Backfill from `days`, skipping rows the user never actually put content in.
-- Copying *every* `days` row into both tables would destroy the distinction the
-- clients rely on between "this day was never started" (no row) and "started but
-- blank" (row with an empty value) — `useNotes`' `exists` flag drives the "Use
-- daily note template / Blank note" chooser, which would then never appear again
-- for any day that happens to carry a journal entry.
--
-- One-time cosmetic consequence: a day where the user explicitly picked "Blank
-- note" (a `days` row with notes = '') is not backfilled, so that day offers the
-- template chooser once more. `on conflict do nothing` keeps this rerunnable.
insert into public.notes (user_id, date, content)
select user_id, date, notes
from public.days
where notes is not null and notes <> ''
on conflict (user_id, date) do nothing;

-- Journals need a *content* test, not the shape test `prompts <> '[]'` — those
-- are not equivalent here. The old shared-row design made the first *note* write
-- seed the day's prompts with empty responses (so the legacy app wouldn't render
-- a blank journal — see 20260713003945), so most rows carry template scaffolding
-- the user never answered: at the time of writing, 160 of 162 `days` rows hold a
-- non-empty prompts array but only 47 hold a single response. Importing the other
-- 113 would make "a journals row exists" mean "a note was written that day",
-- breaking `exists` for the same reason the shape test looks tempting.
-- The `jsonb_typeof` guard is load-bearing, not defensive noise: `days.prompts`
-- carries no array constraint (unlike the new column above), and
-- `jsonb_array_elements` raises on a non-array, which would abort this whole
-- migration. Every production row is an array today, but the legacy client and
-- the dashboard can both still write that column before this runs.
--
-- It has to be a *separate scan* rather than another `and` alongside the
-- `exists`, because Postgres does not promise left-to-right qual evaluation — it
-- reorders quals by cost, so nothing guarantees the type check runs before the
-- subplan that expands the array. `offset 0` is the documented optimization
-- fence that stops the planner flattening this subquery and pulling the outer
-- qual back down into it, which is what makes the ordering actually hold.
insert into public.journals (user_id, date, prompts)
select user_id, date, prompts
from (
  select user_id, date, prompts
  from public.days
  where jsonb_typeof(prompts) = 'array'
  offset 0
) as arrays
where exists (
  select 1
  from jsonb_array_elements(prompts) as entry
  where coalesce(entry ->> 'response', '') <> ''
)
on conflict (user_id, date) do nothing;

-- Emit change events for client cache invalidation, same guarded pattern as
-- 20260717193451_realtime_publication.sql. `days` stays in the publication
-- until it is dropped.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array['journals', 'notes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
