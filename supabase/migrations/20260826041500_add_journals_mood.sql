-- DEX-191: a 1-5 mood score on the day's journal row.

-- Nullable with no default: every existing row predates the feature, and a
-- prompts-only write must not invent a mood. `null` is "not answered".
alter table public.journals
  add column if not exists mood smallint;

-- Constrained where `alarm_sound`/`focus_block_minutes` are not: those lists
-- grow, this one cannot, and the value indexes a five-face table with no guard.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'journals_mood_range'
      and conrelid = 'public.journals'::regclass
  ) then
    alter table public.journals
      add constraint journals_mood_range
      check (mood is null or mood between 1 and 5);
  end if;
end $$;
