-- DEX-47: Search across tasks, notes, and journal entries.
--
-- One function, called by both the app (`src/api/search.ts`) and the MCP server
-- (`functions/mcp-server/tools/search.ts`), so "search" means exactly one thing
-- no matter how it is asked for. It is the abstraction boundary: the signature
-- and result shape are what both callers code against, so a future switch to
-- full-text search or a trigram index changes this body and nothing else.
--
-- Why substring `ilike` and not `tsvector`/`websearch_to_tsquery`:
-- * The UI highlights the matched text and shows surrounding context. Substring
--   matching hands the client exact offsets, so what gets highlighted is
--   provably what matched. FTS stems, so a genuine hit often contains no literal
--   occurrence of the term — `ts_headline` exists for that, but it returns
--   markup a React Native <Text> cannot render.
-- * Mid-word matches work ("eisen" finds "eisenhower"), which is how people
--   actually search their own planner. FTS matches whole lexemes only.
-- * The one benefit FTS would add is relevance ranking, and at this corpus size
--   (92 notes and 48 journals in production at time of writing, tasks in the
--   low thousands) there is no result set to rank — there are about five hits.
--
-- No index, deliberately. A seq scan over that data is sub-millisecond. If it
-- ever stops being: `create extension pg_trgm` plus a
-- `using gin (content gin_trgm_ops)` index makes a leading-wildcard `ilike`
-- indexable *without changing this query at all*.
--
-- SECURITY INVOKER (the first in this schema — the five functions in the
-- baseline are all DEFINER) is the load-bearing choice here, not a formality.
-- It keeps RLS as the enforcement layer, so the app's user-scoped client and the
-- MCP server's user-JWT client are both automatically restricted to the caller's
-- own rows. A DEFINER function would bypass RLS and make correct scoping depend
-- on a hand-written `user_id = auth.uid()` filter in every branch below — three
-- chances to leak another user's journal. An anonymous caller reaches the
-- function (functions in `public` are executable by PUBLIC) but RLS gives it
-- zero rows, so no explicit grant/revoke is needed.
--
-- Rollback: drop function if exists public.search_entries(text);

create or replace function public.search_entries(query text)
returns table (
  kind text,
  entry_date date,
  task jsonb,
  prompt text,
  content text
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
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
