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

GRANT EXECUTE ON FUNCTION "public"."search_entries"(text) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."search_entries"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."search_entries"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."search_entries"(text) TO "postgres";
