-- DEX-227: one-time convergence of migration history with the declarative schema
-- tree exported from production. A semantic no-op on prod, which already matches.

SET local check_function_bodies = off;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

-- pg_net is non-relocatable; rebuild only when the recorded namespace differs.
-- Production already uses public: preserve its queued requests and responses.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension
    WHERE extname = 'pg_net' AND extnamespace <> 'public'::regnamespace
  ) THEN
    DROP EXTENSION "pg_net";
  END IF;
  CREATE EXTENSION IF NOT EXISTS "pg_net" SCHEMA "public";
END;
$$;

COMMENT ON EXTENSION "pg_net" IS 'Async HTTP';

REVOKE ALL ON TABLE "public"."daily_habits" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_habits" TO "anon";

REVOKE ALL ON TABLE "public"."daily_habits" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_habits" TO "authenticated";

REVOKE ALL ON TABLE "public"."daily_habits" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_habits" TO "service_role";

REVOKE ALL ON TABLE "public"."focus_blocks" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."focus_blocks" TO "service_role";

REVOKE ALL ON TABLE "public"."goals" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "anon";

REVOKE ALL ON TABLE "public"."goals" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "authenticated";

REVOKE ALL ON TABLE "public"."goals" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "service_role";

REVOKE ALL ON TABLE "public"."habits" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."habits" TO "anon";

REVOKE ALL ON TABLE "public"."habits" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."habits" TO "authenticated";

REVOKE ALL ON TABLE "public"."habits" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."habits" TO "service_role";

REVOKE ALL ON TABLE "public"."horoscopes" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."horoscopes" TO "service_role";

REVOKE ALL ON TABLE "public"."journals" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."journals" TO "anon";

REVOKE ALL ON TABLE "public"."journals" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."journals" TO "authenticated";

REVOKE ALL ON TABLE "public"."journals" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."journals" TO "service_role";

REVOKE ALL ON TABLE "public"."lists" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."lists" TO "anon";

REVOKE ALL ON TABLE "public"."lists" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."lists" TO "authenticated";

REVOKE ALL ON TABLE "public"."lists" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."lists" TO "service_role";

REVOKE ALL ON TABLE "public"."notes" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notes" TO "anon";

REVOKE ALL ON TABLE "public"."notes" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notes" TO "authenticated";

REVOKE ALL ON TABLE "public"."notes" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notes" TO "service_role";

REVOKE ALL ON TABLE "public"."preferences" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."preferences" TO "anon";

REVOKE ALL ON TABLE "public"."preferences" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."preferences" TO "authenticated";

REVOKE ALL ON TABLE "public"."preferences" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."preferences" TO "service_role";

REVOKE ALL ON TABLE "public"."repeat_task_templates" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."repeat_task_templates" TO "anon";

REVOKE ALL ON TABLE "public"."repeat_task_templates" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."repeat_task_templates" TO "authenticated";

REVOKE ALL ON TABLE "public"."repeat_task_templates" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."repeat_task_templates" TO "service_role";

REVOKE ALL ON TABLE "public"."tasks" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "anon";

REVOKE ALL ON TABLE "public"."tasks" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "authenticated";

REVOKE ALL ON TABLE "public"."tasks" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "service_role";

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

CREATE OR REPLACE FUNCTION public.search_entries (
  query text
)
  RETURNS TABLE (
    kind       text,
    entry_date date,
    task       jsonb,
    prompt     text,
    content    text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
  -- Escape backslash first so later LIKE escapes aren't doubled.
  -- Terms are ANDed; LIKE metacharacters in user input must stay literal.
  with terms as (
    select
      '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
        as pattern
    from unnest(regexp_split_to_array(btrim(query), '\s+')) as term
    where term <> ''
  )

  -- Qualify result columns to avoid ambiguity with RETURNS TABLE parameters.
  select
    results.kind,
    results.entry_date,
    results.task,
    results.prompt,
    results.content
  from (
    -- Every branch needs an exists(terms) guard: with zero terms, not exists
    -- alone would return the caller's entire corpus.
    select
      'task'::text as kind,
      t.scheduled_for as entry_date,
      to_jsonb(t) as task,
      null::text as prompt,
      null::text as content
    from public.tasks t
    cross join lateral (
      select
        t.title || ' ' || coalesce(
          (
            select string_agg(subtask ->> 'title', ' ')
            from jsonb_array_elements(t.subtasks) as subtask
          ),
          ''
        ) as haystack
    ) as h
    where exists (select 1 from terms)
      and not exists (
        select 1 from terms where h.haystack not ilike terms.pattern
      )

    union all

    select
      'note'::text,
      n.date,
      null::jsonb,
      null::text,
      n.content
    from public.notes n
    where exists (select 1 from terms)
      and not exists (
        select 1 from terms where n.content not ilike terms.pattern
      )

    union all

    -- Match responses only, not shared prompts; coalesce prevents malformed
    -- response elements from matching every query through NULL's LIKE semantics.
    select
      'journal'::text,
      j.date,
      null::jsonb,
      p ->> 'prompt',
      p ->> 'response'
    from public.journals j
    cross join lateral jsonb_array_elements(j.prompts) as p
    where exists (select 1 from terms)
      and not exists (
        select 1 from terms
        where coalesce(p ->> 'response', '') not ilike terms.pattern
      )
  ) as results

  -- Clients preserve this order within each kind; undated backlog tasks go last.
  order by results.entry_date desc nulls last
$function$;

CREATE OR REPLACE FUNCTION public.trigger_generate_horoscopes()
  RETURNS bigint
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets
      where name = 'generate_horoscopes_url';

    select decrypted_secret into v_secret
      from vault.decrypted_secrets
      where name = 'generate_horoscopes_secret';
  exception
    when others then
      -- Missing Vault, missing access, or secrets restored with another key
      -- all mean this project's cron is unprovisioned.
      raise warning 'DEX-84: vault is unreadable (% %); skipping horoscope generation.',
        sqlstate, sqlerrm;
      return null;
  end;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise notice 'DEX-84: generate_horoscopes_url/_secret are not provisioned here; skipping.';
    return null;
  end if;

  -- A request id means enqueued, not delivered; check net._http_response
  -- for the actual HTTP result. NULL means this project is unprovisioned.
  select net.http_post(
    url := v_url,
    body := jsonb_build_object('source', 'pg_cron'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$function$;
