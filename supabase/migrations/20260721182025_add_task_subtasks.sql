-- DEX-70: Subtasks
--
-- Subtasks are lightweight checklist items — `{id, title, status}` — stored as a
-- jsonb array on the parent task rather than as rows. This keeps them one level
-- deep by construction, makes "complete the parent, sweep its children" a single
-- atomic row update, and leaves recurrence with no orphan-spawn hazard (array
-- items carry no `template_id`). Repeat templates carry the same array (title
-- only, no status) so each generated occurrence regenerates the checklist.
--
-- Accepted tradeoff: concurrent checklist edits are last-write-wins on the whole
-- array. Mitigable later with RPC array surgery (subtask_add / subtask_set_status
-- / subtask_promote) without a schema change.
--
-- No RLS changes are needed — subtasks live inside rows the existing `user_id`
-- policies already guard — and no triggers are involved. Both tables are already
-- in the realtime publication, so subtask edits sync like any other field.

alter table public.tasks
  add column if not exists subtasks jsonb not null default '[]'::jsonb;

alter table public.repeat_task_templates
  add column if not exists subtasks jsonb not null default '[]'::jsonb;

-- Every reader treats this column as an array without null- or type-guarding,
-- and `jsonb` alone permits an object, string, or number. Enforce the array
-- shape in the database rather than trusting each writer to get it right — the
-- MCP tools validate item shape, but a psql session or dashboard edit does not.
alter table public.tasks
  drop constraint if exists tasks_subtasks_is_array;
alter table public.tasks
  add constraint tasks_subtasks_is_array
  check (jsonb_typeof(subtasks) = 'array');

alter table public.repeat_task_templates
  drop constraint if exists repeat_task_templates_subtasks_is_array;
alter table public.repeat_task_templates
  add constraint repeat_task_templates_subtasks_is_array
  check (jsonb_typeof(subtasks) = 'array');

-- Drop the unused relational `subtask_of` column. It shipped in the original
-- baseline schema but was never app-writable and holds no production rows
-- (verified: 0 of 2836 tasks). This jsonb design supersedes it, and dropping it
-- retires the DEX-4/DEX-32 self-referential-FK RLS saga for good — a policy can
-- never again sub-select `public.tasks` from within a tasks policy and raise
-- `42P17 infinite recursion`.
drop index if exists public.idx_tasks_subtask_of;

alter table public.tasks
  drop constraint if exists tasks_subtask_of_fkey;

alter table public.tasks
  drop column if exists subtask_of;
