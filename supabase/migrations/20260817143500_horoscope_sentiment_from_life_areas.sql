-- DEX-166: Derive `horoscopes.sentiment` from the twelve life areas rather than
-- from `overall_rating`.
--
-- **The panel was almost always blue.** 20260811211500 generated `sentiment`
-- from the upstream's single `overall_rating` with the same 1-5 thresholds the
-- UI applies to one area (>= 4 positive, <= 2 negative, else mixed). The
-- thresholds are fine; the input is not. astrology-api.io returns 3 for
-- `overall_rating` on very nearly every sign every day, and 3 is the one value
-- that buckets to `mixed`, so the Ritual tab's Horoscope panel tinted neutral
-- almost unconditionally (docs/design.md "Sentiment").
--
-- **The new rule is a count, not a threshold.** Each of the twelve
-- `rating_*` columns buckets into positive/mixed/negative by the same
-- thresholds as before; the day takes whichever bucket holds the most areas,
-- and any tie for the top — two-way or three-way — yields `mixed`. This is
-- deliberately the majority and not the mean: an average over twelve values
-- clusters hard around the middle and would have reproduced the same
-- always-neutral failure through a different arithmetic.
--
-- It also fixes a subtler thing than variability. `overall_rating` is rendered
-- nowhere — the step draws the twelve areas sorted into three bands
-- (src/utils/horoscope.ts `lifeAreasInBucket`), so the panel behind that chart
-- was colored by a hidden thirteenth number no reader could see. The tint is
-- now the largest band drawn on top of it, by construction.
--
-- **`overall_rating` stays.** Nothing reads it after this migration, and that
-- is on purpose: it is faithful upstream payload, it is two bytes, and a
-- provider value is cheaper to keep than to backfill if the UI ever wants it.
--
-- Why a function rather than the expression inline: the counting rule spelled
-- out as a bare `case` is the same twelve-column `filter` clause written three
-- times, and `generated always as` gives no way to factor it. The function is
-- also the only form the rule can be tested in — a stored generated column can
-- only be observed by inserting rows.
--
-- Two constraints on that function, both of which fail late if missed:
-- * It **must** be `IMMUTABLE`. `generated always as` rejects anything merely
--   `STABLE`, and the rejection only surfaces when the migration runs.
-- * Postgres records no dependency from a stored generated column on the *body*
--   of a function it calls. `create or replace` on the function below will
--   **not** recompute a single stored row — it would leave the table holding
--   values no expression in the schema produces. Any future change to this rule
--   needs its own drop/re-add migration, exactly like this one.
--
-- The drop/re-add is itself forced: `alter table ... alter column ... set
-- expression` is Postgres 17 and supabase/config.toml pins major_version 15.
-- Re-adding a stored generated column rewrites the table, which recomputes
-- every existing row — so this migration needs no backfill step. The table is
-- twelve rows a day of global reference data with no index on `sentiment` and
-- no view over it, so the rewrite and the exclusive lock are both free here.
--
-- Rollback:
--   alter table public.horoscopes drop column sentiment;
--   alter table public.horoscopes add column sentiment public.horoscope_sentiment
--     not null generated always as (
--       case
--         when overall_rating >= 4 then 'positive'::public.horoscope_sentiment
--         when overall_rating <= 2 then 'negative'::public.horoscope_sentiment
--         else 'mixed'::public.horoscope_sentiment
--       end
--     ) stored;
--   drop function if exists public.horoscope_sentiment_from_ratings(smallint[]);

-- `variadic` so the call site below reads as the twelve columns it is, rather
-- than as an array literal wrapping them.
--
-- `set search_path` is this schema's convention (see search_entries in
-- 20260727232854), and it matters more than usual for a function that will be
-- baked into a generated column: everything it resolves, it resolves once per
-- written row, forever. The body schema-qualifies anyway — belt and braces,
-- since `unnest` is the kind of name a later extension could shadow.
create or replace function public.horoscope_sentiment_from_ratings(
  variadic ratings smallint[]
)
returns public.horoscope_sentiment
language sql
immutable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
  select case
    -- Strict `>` on both comparisons is the whole tie rule: a bucket wins only
    -- by outnumbering *both* others, so any tie for the top falls through to
    -- `mixed`. That includes the tie between the two ends — six positive areas
    -- against six negative ones is the most mixed a day can be, and reading it
    -- as either end would be a coin flip shown as a judgement.
    when positive > mixed and positive > negative
      then 'positive'::public.horoscope_sentiment
    when negative > mixed and negative > positive
      then 'negative'::public.horoscope_sentiment
    else 'mixed'::public.horoscope_sentiment
  end
  from (
    -- The same thresholds `ratingBucket()` applies in src/utils/horoscope.ts,
    -- and they must stay the same: a band of down arrows under a green panel
    -- would be a bug, and it is these three lines that make that impossible.
    -- The middle takes the odd width because a lone 3 is the genuinely
    -- neutral value.
    select
      count(*) filter (where rating >= 4) as positive,
      count(*) filter (where rating = 3) as mixed,
      count(*) filter (where rating <= 2) as negative
    from pg_catalog.unnest(ratings) as rating
  ) counts;
$function$;

comment on function public.horoscope_sentiment_from_ratings(smallint[]) is
  'DEX-166: the day''s sentiment as the most common life-area bucket (>= 4 positive, <= 2 negative, else mixed), with any tie for the top yielding mixed. Baked into the horoscopes.sentiment generated column — replacing this body does NOT recompute stored rows.';

-- `if exists` on the drop per docs/backend.md's stand-alone rule, but
-- deliberately **no `if not exists` on the add**, and the asymmetry is the
-- point: a column that already exists here is one carrying the old
-- `overall_rating` expression, and `if not exists` would skip past it silently,
-- leaving the table generating values this migration exists to replace. Failing
-- loudly is the correct outcome in the one case that clause would cover.
--
-- Table-level grants cover columns added later (`grant select on
-- public.horoscopes to authenticated` in 20260811211500 — no column-level
-- grants anywhere on this table), so the re-added column needs no re-grant.
alter table public.horoscopes
  drop column if exists sentiment;

alter table public.horoscopes
  add column sentiment public.horoscope_sentiment not null generated always as (
    public.horoscope_sentiment_from_ratings(
      rating_identity,
      rating_health,
      rating_finance,
      rating_career,
      rating_love,
      rating_relationships,
      rating_creativity,
      rating_spirituality,
      rating_home,
      rating_learning,
      rating_communication,
      rating_travel
    )
  ) stored;

comment on column public.horoscopes.sentiment is
  'DEX-166: derived, never written. The most common bucket among the twelve rating_* columns; ties yield mixed. Was generated from overall_rating, which returned 3 nearly every day and tinted the ritual panel neutral almost unconditionally.';
