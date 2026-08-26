-- DEX-151: `template_prompts` becomes a jsonb array of `{id, prompt, period}`,
-- so each journal prompt is asked by the morning ritual or the evening one.

-- add/update/drop/rename rather than `alter column ... type ... using`:
-- aggregating an array into one jsonb value needs a subquery, which USING rejects.
alter table public.preferences
  add column if not exists template_prompts_jsonb jsonb;

-- Every existing prompt becomes a morning one, in order (`with ordinality`).
-- `coalesce` covers an emptied list — `jsonb_agg` over no rows is NULL, not `[]`.
update public.preferences
set template_prompts_jsonb = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'prompt', prompt,
        'period', 'am'
      )
      order by ord
    )
    from unnest(template_prompts) with ordinality as t(prompt, ord)
  ),
  '[]'::jsonb
);

alter table public.preferences
  drop column template_prompts;

alter table public.preferences
  rename column template_prompts_jsonb to template_prompts;

alter table public.preferences
  alter column template_prompts set not null;

-- Only a fresh signup reads this, so no existing account gains an evening prompt.
-- `gen_random_uuid()` is volatile, so each account gets its own ids.
alter table public.preferences
  alter column template_prompts set default jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'prompt', 'Today I am grateful for',
      'period', 'am'
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'prompt', 'Today I am excited for',
      'period', 'am'
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'prompt', 'What would make today great',
      'period', 'am'
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'prompt', 'Today''s highlight',
      'period', 'pm'
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'prompt', 'Today I learned',
      'period', 'pm'
    )
  );

-- The shape test `journals.prompts` carries. `add constraint if not exists` is
-- not valid Postgres, hence the guard.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'preferences_template_prompts_is_array'
      and conrelid = 'public.preferences'::regclass
  ) then
    alter table public.preferences
      add constraint preferences_template_prompts_is_array
      check (jsonb_typeof(template_prompts) = 'array');
  end if;
end $$;
