-- DEX-84: Daily sun-sign horoscopes.
--
-- One row per sign per day, fetched from AstrologyAPI by the
-- `generate-horoscopes` Edge Function and condensed to a short `summary` and a
-- `sentiment` label by an LLM. See 20260804005119_schedule_generate_horoscopes.sql
-- for the pg_cron job that drives it, and docs/backend.md "Horoscopes".
--
-- This is the first table in the schema that nobody owns: horoscopes are global
-- reference data, not user data. That drives most of what follows.
--
-- Shape notes:
-- * PK is (sun_sign, date), not (date, sun_sign). Both orders serve the point
--   lookup "my sign, today" identically — both columns are equality predicates.
--   Only this order additionally serves `where sun_sign = $1 order by date desc`
--   via the leftmost-prefix rule, which is the history query a horoscope UI
--   plausibly wants next. No secondary index: at twelve rows a day (~4,400 a
--   year) anything the PK does not cover is a trivial scan, and a speculative
--   index on an unwritten query costs more than it saves.
-- * The natural key is real, so there is deliberately no `id` — and it gives
--   `on conflict (sun_sign, date) do update` for free, which is what makes the
--   generator safe to retry.
-- * Deliberately no `user_id`, `updated_at`, or `archived_at` (a deviation from
--   the create-migration skill's new-table template): the rows are not
--   user-scoped, nothing in this schema maintains an `updated_at` today, and a
--   horoscope is regenerated in place rather than soft-deleted.
-- * `summary` is `text`, not `varchar(100)`. The ~100-character limit is a
--   prompt instruction, not a storage constraint — a schema-level cap would
--   turn a slightly-long generation into a failed insert instead of a slightly
--   long summary, and the limit is expected to move with prompt tuning.
-- * The `*_rating` columns are unvalidated third-party input, so each carries a
--   0..10 check. That bound is also what makes `numeric(4,2)` provably wide
--   enough for `average_rating`.
-- * `average_rating` is a stored generated column rather than a value the
--   function computes. "The average of all _rating fields" is then true by
--   construction, with no code path that can drift from it.
--
-- These are the schema's first Postgres enums, which cuts against two existing
-- decisions worth naming: `tasks.status` is a bare `smallint` with no enum or
-- check (docs/backend.md "Edge Functions"), and `preferences.alarm_sound` is
-- deliberately unconstrained text because that list is app-owned and expected to
-- grow. Enums are right here only because both sets are genuinely closed —
-- there will never be a thirteenth sun sign. The cost is real and permanent:
-- values can never be removed, and adding one needs `alter type ... add value`.
-- If `horoscope_sentiment` ever wants a fourth label, that is the migration to
-- write; do not reach for it casually.
--
-- Rollback:
--   drop table if exists public.horoscopes;
--   drop type if exists public.horoscope_sentiment;
--   drop type if exists public.sun_sign;

-- `create type` has no IF NOT EXISTS. `to_regtype` returns NULL rather than
-- raising for an unknown type, which makes it the right guard here: production
-- applies migrations with `db push --include-all`, so this file must be safe to
-- replay (docs/backend.md "Deployment").
do $$
begin
  if to_regtype('public.sun_sign') is null then
    -- Declaration order is the astrological order, so `order by sun_sign`
    -- sorts the way a reader expects rather than alphabetically.
    create type public.sun_sign as enum (
      'aries',
      'taurus',
      'gemini',
      'cancer',
      'leo',
      'virgo',
      'libra',
      'scorpio',
      'sagittarius',
      'capricorn',
      'aquarius',
      'pisces'
    );
  end if;

  if to_regtype('public.horoscope_sentiment') is null then
    create type public.horoscope_sentiment as enum (
      'positive',
      'negative',
      'mixed'
    );
  end if;
end $$;

-- Constraints are declared inline rather than added afterwards: `create table
-- if not exists` makes the whole statement idempotent, whereas `alter table ...
-- add constraint` has no IF NOT EXISTS form and would need a pg_constraint
-- guard of its own.
create table if not exists public.horoscopes (
  sun_sign public.sun_sign not null,
  date date not null,
  summary text not null,
  sentiment public.horoscope_sentiment not null,
  personal_life text not null,
  profession text not null,
  health text not null,
  emotions text not null,
  travel text not null,
  luck text not null,
  personal_life_rating smallint not null check (personal_life_rating between 0 and 10),
  profession_rating smallint not null check (profession_rating between 0 and 10),
  health_rating smallint not null check (health_rating between 0 and 10),
  emotions_rating smallint not null check (emotions_rating between 0 and 10),
  travel_rating smallint not null check (travel_rating between 0 and 10),
  luck_rating smallint not null check (luck_rating between 0 and 10),
  average_rating numeric(4, 2) generated always as (
    (
      personal_life_rating + profession_rating + health_rating
      + emotions_rating + travel_rating + luck_rating
    ) / 6.0
  ) stored,
  created_at timestamptz not null default now(),
  primary key (sun_sign, date)
);

comment on table public.horoscopes is
  'DEX-84: one sun-sign prediction per day. Global reference data, not user-owned: readable by any signed-in user, written only by the service role via the generate-horoscopes Edge Function.';

alter table public.horoscopes enable row level security;

-- A blanket read policy, unlike every other table in this schema. There is no
-- `user_id` to compare against, so the usual `(SELECT auth.uid()) = user_id`
-- form — and the "index the columns used in RLS policies" guidance that goes
-- with it — simply does not apply. `using (true)` is the intent, not an
-- oversight.
drop policy if exists "Anyone signed in can read horoscopes" on "public"."horoscopes";
create policy "Anyone signed in can read horoscopes" on "public"."horoscopes"
  as permissive
  for select
  to "authenticated"
  using (true);

-- No INSERT/UPDATE/DELETE policies, deliberately. With RLS enabled, the absence
-- of a policy is itself the denial — `anon` and `authenticated` cannot write
-- these rows at all, and `service_role` (which bypasses RLS) is the only writer.
--
-- Every grant this table needs is stated explicitly below rather than inherited,
-- because the inherited set is not what you would guess. `alter default
-- privileges` for `postgres` in `public` on this stack grants only `Dxt`
-- (TRUNCATE, REFERENCES, TRIGGER) to `anon`, `authenticated`, and
-- `service_role` — no SELECT, INSERT, UPDATE, or DELETE. The baseline's
-- `grant all on all tables in schema public` (20260429214000, line ~626) was a
-- one-time snapshot and does not reach tables created afterwards. So:
--
--   * `service_role` does NOT get DML for free. BYPASSRLS exempts it from
--     policies, not from grants, so without the grant below the Edge Function's
--     upsert fails with "permission denied" even though RLS never fires.
--   * `authenticated` does NOT get SELECT for free either, which is why the
--     read grant is spelled out rather than assumed.
--
-- The revoke is still worth keeping: it is what makes the intent legible in
-- `\dp` and what keeps a future change to the default privileges from silently
-- widening this table.
revoke all on public.horoscopes from anon, authenticated;
grant select on public.horoscopes to authenticated;
-- Exactly what the generator uses: SELECT for the already-generated precheck,
-- INSERT and UPDATE for the upsert. No DELETE — nothing removes these rows.
grant select, insert, update on public.horoscopes to service_role;

-- `force row level security` is deliberately NOT set. `service_role` holds
-- BYPASSRLS, which is checked ahead of FORCE, so it would add nothing against
-- the actual writer — it would only strip `postgres`'s owner exemption and
-- block a future migration-time backfill. No other table in this schema uses it.

-- Not added to the `supabase_realtime` publication (contrast
-- 20260726215745_split_notes_journals.sql): these rows change once a day at a
-- fixed hour, so a subscription would idle for 24 hours to deliver what a
-- refetch already gets. Nothing here is user-scoped, so there is also no DELETE
-- filtering concern to design the PK around.
