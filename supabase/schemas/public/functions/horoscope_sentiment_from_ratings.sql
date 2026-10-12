CREATE OR REPLACE FUNCTION public.horoscope_sentiment_from_ratings (
  VARIADIC ratings smallint[]
)
  RETURNS public.horoscope_sentiment
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
  select case
    -- Strict > makes every tie for the largest bucket mixed, including a tie
    -- between positive and negative with no neutral ratings.
    when positive > mixed and positive > negative
      then 'positive'::public.horoscope_sentiment
    when negative > mixed and negative > positive
      then 'negative'::public.horoscope_sentiment
    else 'mixed'::public.horoscope_sentiment
  end
  from (
    -- Keep these thresholds aligned with ratingBucket() in src/utils/horoscope.ts.
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
