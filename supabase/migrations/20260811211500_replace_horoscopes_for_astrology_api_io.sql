-- DEX-145: Rebuild `public.horoscopes` for the astrology-api.io v3 payload.
--
-- The provider changed, and with it every column but the key. AstrologyAPI
-- billed per call (~$0.27, ~$97/month for twelve signs a day); astrology-api.io
-- is a flat monthly quota. It also returns display-ready prose, which is why the
-- LLM `summary`/`sentiment` generation is gone from the Edge Function entirely —
-- see supabase/functions/generate-horoscopes/ and docs/backend.md "Horoscopes".
--
-- **This drops the table rather than altering it.** Nothing here is user data:
-- horoscopes are global reference rows regenerated every morning by the cron in
-- 20260804005119_schedule_generate_horoscopes.sql, and the feature had not
-- shipped (two `preferences` rows had a `sun_sign` at all, one of them the demo
-- account). Seven of the eleven columns had no counterpart in the new payload,
-- so an ALTER would have been a drop and an add wearing a disguise. The next
-- cron run refills the table.
--
-- What carries over from 20260804005118_add_horoscopes.sql, and why:
-- * **PK is still (sun_sign, date), in that order.** Both columns are equality
--   predicates for "my sign, today", so either order serves it; only this one
--   also serves `where sun_sign = $1 order by date desc` by leftmost prefix.
--   Still no secondary index — twelve rows a day is a trivial scan.
-- * **Still no `id`, `user_id`, `updated_at`, or `archived_at`.** The natural
--   key is real and gives `on conflict (sun_sign, date) do update` for free,
--   which is what makes the generator safe to re-run; the rows are not
--   user-scoped, and a horoscope is regenerated in place rather than soft-deleted.
-- * **Both enums are reused as-is**, so this migration adds no type. `sun_sign`
--   is unchanged. `horoscope_sentiment` survives for a subtler reason: the
--   v3 payload has no sentiment field, but the three-way tint is a whole design
--   system (docs/design.md "Sentiment"), so the label is now *derived* — see
--   the generated column below.
--
-- What changed, and why the old file argued the opposite:
-- * **There are rating columns now.** 20260804005118 argued at length for
--   omitting them: DEX-84's sample response had six `<facet>_rating` integers,
--   the live AstrologyAPI returned none, and NOT NULL rating columns would have
--   failed every insert. That reasoning was correct about that provider. v3
--   returns `overall_rating` plus a `life_area_focus[]` array, verified
--   2026-08-11 against `aries`, `leo`, `scorpio`, and `virgo` across two dates —
--   always all twelve areas, always the same order.
-- * **Twelve `rating_*` columns, not a child table or jsonb.** The set is closed
--   and fixed-length: the twelve areas are the twelve astrological houses, so a
--   thirteenth is no more likely than a thirteenth sun sign. Flat columns keep
--   the read a single row with no join, and keep every value typed and
--   range-checked, which a jsonb blob would not.
-- * **The six text facets are gone.** `personal_life`, `profession`, `health`,
--   `emotions`, `travel`, and `luck` were AstrologyAPI's shape. v3 gives one
--   prose field plus ratings, so the UI reads tips and rated areas instead
--   (docs/frontend.md "Horoscope step").
--
-- Rollback:
--   drop table if exists public.horoscopes;
--   -- then re-apply 20260804005118_add_horoscopes.sql's create table.
--   -- The enums are shared and deliberately left alone.

drop table if exists public.horoscopes;

create table public.horoscopes (
  sun_sign public.sun_sign not null,
  date date not null,

  -- The provider's own display copy, requested with `format: "short"` (~35
  -- words). `text` is a non-reserved keyword, so it needs no quoting; it is
  -- named for the payload field rather than the old `summary` because it is no
  -- longer a summary of anything — it is the horoscope.
  text text not null,

  -- 1-5. `smallint` rather than `int`: the range is fixed by the upstream and
  -- two bytes is exactly enough.
  overall_rating smallint not null
    check (overall_rating between 1 and 5),

  -- Derived, never written. The Edge Function does not compute this and the
  -- upsert does not name it — Postgres does, which is the point: the tint and
  -- the rating cannot drift apart the way two independently-written columns
  -- can. The thresholds are the same three buckets the UI groups life areas
  -- into (docs/design.md "Sentiment").
  --
  -- The enum cast is IMMUTABLE — a string literal cast to an enum resolves to a
  -- constant at parse time — which is what makes it legal in a generated
  -- column. Verified against this database before writing this file, because
  -- `generated always as` rejects anything merely STABLE and the failure only
  -- shows up at migration time.
  sentiment public.horoscope_sentiment not null generated always as (
    case
      when overall_rating >= 4 then 'positive'::public.horoscope_sentiment
      when overall_rating <= 2 then 'negative'::public.horoscope_sentiment
      else 'mixed'::public.horoscope_sentiment
    end
  ) stored,

  -- Three short actionable lines. An array rather than a child table: they are
  -- always read together, never queried individually, and never joined to
  -- anything. `default '{}'` so a provider that omits them yields an empty list
  -- rather than a null the UI has to branch on.
  tips text[] not null default '{}',

  -- `life_area_focus[]`, flattened. Column order is the array's order, which is
  -- house order, so this table reads the way the payload does.
  rating_identity smallint not null check (rating_identity between 1 and 5),
  rating_health smallint not null check (rating_health between 1 and 5),
  rating_finance smallint not null check (rating_finance between 1 and 5),
  rating_career smallint not null check (rating_career between 1 and 5),
  rating_love smallint not null check (rating_love between 1 and 5),
  rating_relationships smallint not null check (rating_relationships between 1 and 5),
  rating_creativity smallint not null check (rating_creativity between 1 and 5),
  rating_spirituality smallint not null check (rating_spirituality between 1 and 5),
  rating_home smallint not null check (rating_home between 1 and 5),
  rating_learning smallint not null check (rating_learning between 1 and 5),
  rating_communication smallint not null check (rating_communication between 1 and 5),
  rating_travel smallint not null check (rating_travel between 1 and 5),

  created_at timestamptz not null default now(),
  primary key (sun_sign, date)
);

comment on table public.horoscopes is
  'DEX-145: one sun-sign horoscope per day from astrology-api.io v3. Global reference data, not user-owned: readable by any signed-in user, written only by the service role via the generate-horoscopes Edge Function.';

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
-- Every grant is stated explicitly rather than inherited, because the inherited
-- set is not what you would guess. `alter default privileges` for `postgres` in
-- `public` on this stack grants only `Dxt` (TRUNCATE, REFERENCES, TRIGGER) to
-- `anon`, `authenticated`, and `service_role` — no SELECT, INSERT, UPDATE, or
-- DELETE. The baseline's `grant all on all tables in schema public` was a
-- one-time snapshot and does not reach tables created afterwards. So:
--
--   * `service_role` does NOT get DML for free. BYPASSRLS exempts it from
--     policies, not from grants, so without the grant below the Edge Function's
--     upsert fails with "permission denied" even though RLS never fires.
--   * `authenticated` does NOT get SELECT for free either.
--
-- Re-stated here rather than assumed to survive the drop: dropping the table
-- dropped its grants with it.
revoke all on public.horoscopes from anon, authenticated;
grant select on public.horoscopes to authenticated;
-- Exactly what the generator uses: SELECT for the already-generated precheck,
-- INSERT and UPDATE for the upsert. No DELETE — nothing removes these rows.
-- `sentiment` is generated, so it is never in the insert's column list.
grant select, insert, update on public.horoscopes to service_role;

-- `force row level security` is deliberately NOT set. `service_role` holds
-- BYPASSRLS, which is checked ahead of FORCE, so it would add nothing against
-- the actual writer — it would only strip `postgres`'s owner exemption and
-- block a future migration-time backfill. No other table in this schema uses it.

-- Not added to the `supabase_realtime` publication: these rows change once a day
-- at a fixed hour, so a subscription would idle for 24 hours to deliver what a
-- refetch already gets.
