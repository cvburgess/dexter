CREATE OR REPLACE FUNCTION public.horoscope_sentiment_from_ratings (
  VARIADIC ratings smallint[]
)
  RETURNS public.horoscope_sentiment
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
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

GRANT EXECUTE ON FUNCTION "public"."horoscope_sentiment_from_ratings"(smallint[]) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."horoscope_sentiment_from_ratings"(smallint[]) TO "service_role";

COMMENT ON FUNCTION "public"."horoscope_sentiment_from_ratings"(smallint[]) IS 'DEX-166: the day''s sentiment as the most common life-area bucket (>= 4 positive, <= 2 negative, else mixed), with any tie for the top yielding mixed. Baked into the horoscopes.sentiment generated column — replacing this body does NOT recompute stored rows.';

REVOKE ALL ON FUNCTION "public"."horoscope_sentiment_from_ratings"(smallint[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."horoscope_sentiment_from_ratings"(smallint[]) TO "postgres";
