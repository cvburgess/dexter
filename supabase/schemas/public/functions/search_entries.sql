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
  -- Every whitespace-separated term must appear somewhere in the row's text
  -- (AND, not phrase): searching "buy milk" finds a note reading
  -- "milk — remember to buy".
  --
  -- The nested `replace`s escape LIKE's metacharacters. Without them a query
  -- containing `%` matches every row, and one containing `_` matches any single
  -- character — a user typing "50%" would get their entire corpus back.
  -- Backslash is escaped first, or it would double the escapes added after it.
  -- `\` is LIKE's default escape character, so no ESCAPE clause is needed.
  with terms as (
    select
      '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
        as pattern
    from unnest(regexp_split_to_array(btrim(query), '\s+')) as term
    where term <> ''
  )

  -- The union is wrapped and ordered from outside so the sort key can be
  -- table-qualified. RETURNS TABLE puts `kind`/`entry_date`/`task`/`prompt`/
  -- `content` in scope inside the body as OUT parameters, and a bare
  -- `order by entry_date` is then ambiguous between the parameter and the
  -- output column. Qualifying it (`results.entry_date`) resolves to the column;
  -- every other reference below is already table-qualified for the same reason.
  select
    results.kind,
    results.entry_date,
    results.task,
    results.prompt,
    results.content
  from (
    -- `exists (select 1 from terms)` is not redundant with the `not exists`
    -- beside it: with zero terms (an empty or all-whitespace query) the
    -- `not exists` is vacuously true for every row, and the branch would return
    -- the caller's entire corpus. Every branch needs its own copy.
    --
    -- Tasks match on their own title or any subtask title — a subtask hit
    -- surfaces its parent card, since subtasks are jsonb inside the parent row,
    -- not rows of their own. `to_jsonb(t)` rather than a column list, so a
    -- future task column reaches the client's TTask without touching this
    -- function. The `::` casts fix the union's type resolution explicitly
    -- rather than leaning on unknown-literal inference.
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

    -- One result per *matching response*, not per journal day: the UI shows
    -- which question the hit came from, and a day holds several.
    --
    -- Matched on the **response only**. The prompt is still selected — the
    -- result card shows it for context — but it is deliberately not searchable:
    -- prompts come from a shared template (`preferences.templatePrompts`), so
    -- every day carries the same handful of questions. Searching them means a
    -- word like "well" from "What went well?" returns every journal entry the
    -- user has ever written, burying the days they actually wrote that word in.
    -- Only the responses are the user's own text.
    --
    -- A consequence worth knowing: an unanswered prompt can no longer match
    -- anything, since an empty response can't contain a term. That is the
    -- intent — a blank day is not a search hit.
    --
    -- `coalesce` guards the `->>` because `prompts` only guarantees an array
    -- (see the journals_prompts_is_array constraint), not the shape of its
    -- elements — a null there would make `not ilike` evaluate to NULL, the
    -- inner `exists` find nothing, and the row match every query.
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

  -- Most recent first, with undated (backlog) tasks last. Substring matching has
  -- no relevance score to sort by; the client groups these into Tasks / Notes /
  -- Journal sections and preserves this order within each.
  order by results.entry_date desc nulls last
$function$;

GRANT EXECUTE ON FUNCTION "public"."search_entries"(text) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."search_entries"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."search_entries"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."search_entries"(text) TO "postgres";
