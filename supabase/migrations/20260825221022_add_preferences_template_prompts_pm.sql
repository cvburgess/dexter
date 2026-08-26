-- DEX-151: The evening half of the journal's prompt template.
--
-- Journal prompts were one list shown by both rituals, so the same questions
-- opened and closed the day. This column splits them: `template_prompts` is now
-- the **morning** list and `template_prompts_pm` the evening one. A prompt lives
-- in exactly one of them — there is no "both", by design, so a prompt's period
-- is a property of which array holds it rather than a value stored beside it.
--
-- It also reshapes the *starter* set both columns hand a new account; see the
-- second half of this file. No stored list changes either way.
--
-- **`template_prompts` is deliberately untouched, and that is the whole reason
-- for a second array rather than a reshaped column.** Reshaping it into a jsonb
-- array of `{prompt, period}` would model the same thing more directly, but the
-- legacy `dexter-app` still runs against this project (deprecated in DEX-71, but
-- shipped DEX-89 to keep reading the notes/journals tables) and reads
-- `template_prompts` as a `string[]` in three places, including its own settings
-- editor. Leaving the column alone keeps that app working and makes the issue's
-- "default every existing prompt to AM" a no-op: they are already in the array
-- that now means morning, so this migration backfills nothing and rewrites no
-- rows.
--
-- NOT NULL for the reason every `enable_*` column here is: the read paths treat
-- it as a plain array without null-guarding, and "unset" is not a meaningful
-- third state. Defaulting to empty rather than to a starter set is the point of
-- the feature — an upgrading user keeps exactly the morning journal they had and
-- has no evening step until they ask for one.
--
-- No CHECK, the same call `alarm_sound` and `breathing_technique` make: the
-- content is app-owned prose, and nothing bounds a journal prompt anywhere (see
-- the header on `functions/mcp-server/tools/journals.ts`).
--
-- `text[]` rather than the sibling's `character varying[]`: the two are
-- interchangeable to PostgREST and both generate `string[]`, and `text` is what
-- the rest of the schema reaches for. Bound `template_prompts` first if either
-- ever needs a limit.
--
-- No RLS changes are needed — the existing `user_id` policies on `preferences`
-- already cover the new column, as do the table-level grants.
--
-- Rollback:
--   alter table public.preferences drop column if exists template_prompts_pm;
--   alter table public.preferences alter column template_prompts set default
--     ARRAY['Yesterday''s highlight','Today I am grateful for',
--           'Today I am excited for','What matters most today']::character varying[];

alter table public.preferences
  add column if not exists template_prompts_pm text[] not null default '{}';

-- The starter set, reshaped now that a prompt belongs to one half of the day.
--
-- The morning loses "Yesterday's highlight" and the evening gains "Today's
-- highlight": asking for a highlight the next morning was the old list working
-- around having only one journal, and an evening that ends on the day's best
-- moment is the better version of the same question. "What matters most today"
-- becomes "What would make today great" for the same reason the evening asks
-- what was learned rather than what went wrong — the morning sets an intention
-- it can meet, and the evening reflects without grading.
--
-- **`SET DEFAULT` as a separate statement, and the `ADD COLUMN` above keeps its
-- empty default — that ordering is the whole point.** `ADD COLUMN` backfills
-- every existing row with the default in force *at that moment*, so writing the
-- evening prompts into the `ADD COLUMN` would hand two of them to every account
-- that already exists and hang an evening Journal step on people who never
-- asked for one. Existing rows take `'{}'` and stay morning-only until their
-- owner moves a prompt; only rows inserted from here on get the pair.
--
-- The morning's default is safe to change outright: a default is read only when
-- a row is inserted without a value, and `create_user_preferences()` inserts
-- `(user_id)` alone, so this reaches new signups and touches no stored list.
alter table public.preferences
  alter column template_prompts set default ARRAY[
    'Today I am grateful for',
    'Today I am excited for',
    'What would make today great'
  ]::character varying[];

alter table public.preferences
  alter column template_prompts_pm set default ARRAY[
    'Today''s highlight',
    'Today I learned'
  ]::text[];
