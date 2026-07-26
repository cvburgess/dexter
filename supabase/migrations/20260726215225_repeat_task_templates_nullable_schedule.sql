-- DEX-65: task templates.
--
-- A `repeat_task_templates` row with a NULL schedule is a reusable task
-- template rather than a repeat task — the row already carries everything a
-- template needs (title, priority, list, goal, alarm, subtask blueprint), so
-- the two concepts share one table and are told apart by `schedule`.
--
-- No policy work is needed: both the INSERT policy (production baseline) and
-- the UPDATE policy (20260708040856_rls_update_ownership_with_check) already
-- guard the cron regex with `schedule IS NULL OR ...`. Both recurrence
-- consumers (src/hooks/useTasks.tsx, mcp-server/tools/tasks.ts) already
-- early-return on a falsy schedule, so a template can never spawn occurrences.
--
-- The default is dropped alongside NOT NULL. A nullable column that defaults to
-- a daily cron would make "schedule omitted" silently mean "repeats every day",
-- which is exactly the wrong reading now that NULL is meaningful. Every caller
-- now states which of the two it wants.
--
-- Rollback: backfill the NULLs, then restore the default and the constraint:
--   update public.repeat_task_templates set schedule = '0 0 * * *'
--     where schedule is null;
--   alter table public.repeat_task_templates
--     alter column schedule set default '0 0 * * *'::character varying;
--   alter table public.repeat_task_templates
--     alter column schedule set not null;

alter table public.repeat_task_templates
  alter column schedule drop not null;

alter table public.repeat_task_templates
  alter column schedule drop default;
