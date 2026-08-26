-- DEX-151: Give every journal prompt a ritual, and a stable id to carry it.
--
-- Journal prompts were one list shown by both rituals, so the same questions
-- opened and closed the day. `template_prompts` becomes a jsonb array of
-- `{id, prompt, period}` — a prompt belongs to the morning **or** the evening,
-- never both.
--
-- **Why jsonb rather than a second `template_prompts_pm` array.** Two arrays
-- carry the period implicitly, as "which column holds this", and that costs
-- three things worth more than the type safety `text[]` would have kept:
--
--   * A period change becomes two writes that must land together (leave the
--     prompt in both lists or neither) where here it is one field on one
--     element.
--   * Two lists have no order *between* them, so moving a prompt between
--     rituals would have to move the row in the editor. Here it stays put.
--   * There is nowhere to put an id, so the prompt *text* becomes the
--     identity and a rename is indistinguishable from delete-plus-add.
--
-- It also matches `journals.prompts`, which is already a jsonb array of objects
-- and already carries `period` on each entry — the day's answers and the
-- template they seed from now have the same shape.
--
-- **`id` is unique within one user's list, not globally.** It is an array key,
-- the same contract `tasks.subtasks` states (`utils/subtasks.ts`), so the app
-- mints one without pulling in a native crypto dependency and the default below
-- is free to hand every new account its own fresh set.
--
-- **Existing prompts all become morning prompts, and no account gains an
-- evening one.** That is the conversion below, not the default: a default is
-- read only when a row is inserted without a value, and
-- `create_user_preferences()` inserts `(user_id)` alone. So every account that
-- exists keeps exactly the prompts it had, in order, and has no evening Journal
-- step until its owner moves one. Only signups from here on get the pair.
--
-- The starter set is reshaped at the same time. The morning loses "Yesterday's
-- highlight" and the evening gains "Today's highlight": asking for a highlight
-- the next morning was the old list working around having only one journal, and
-- an evening that ends on the day's best moment is the better version of the
-- same question. "What matters most today" becomes "What would make today
-- great" for the same reason the evening asks what was learned rather than what
-- went wrong — the morning sets an intention it can meet, and the evening
-- reflects without grading.
--
-- No RLS changes are needed — the existing `user_id` policies on `preferences`
-- already cover the column, as do the table-level grants.
--
-- Rollback (loses every period, and every prompt's id):
--   alter table public.preferences drop constraint if exists
--     preferences_template_prompts_is_array;
--   alter table public.preferences add column tp_text character varying[];
--   update public.preferences set tp_text = coalesce((
--     select array_agg(entry ->> 'prompt' order by ord)
--     from jsonb_array_elements(template_prompts) with ordinality as t(entry, ord)
--   ), '{}');
--   alter table public.preferences drop column template_prompts;
--   alter table public.preferences rename column tp_text to template_prompts;

-- The type change runs as add/update/drop/rename rather than `alter column ...
-- type ... using`: turning an array into one aggregated jsonb value needs a
-- subquery, and `USING` rejects those ("cannot use subquery in transform
-- expression"). The default has to go first either way — Postgres will not
-- re-type a column whose default cannot be cast to the new type.
alter table public.preferences
  alter column template_prompts drop default;

alter table public.preferences
  add column if not exists template_prompts_jsonb jsonb;

-- `with ordinality` keeps each prompt in the position its owner put it in;
-- `jsonb_agg` alone would be free to reorder. `coalesce` covers an account that
-- had emptied its list, since `jsonb_agg` over no rows is NULL, not `[]`.
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

-- A fresh id per account rather than five literals baked into the default:
-- `gen_random_uuid()` is volatile and re-evaluates per insert, and ids that
-- repeated across every new signup would quietly invite the assumption that
-- they are unique across users.
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

-- The shape test `journals.prompts` already carries, for the same reason: every
-- reader treats this as an array and maps it. `add constraint if not exists` is
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
