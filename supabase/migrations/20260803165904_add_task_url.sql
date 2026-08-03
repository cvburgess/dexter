-- DEX-66: Task links
--
-- Adds an optional link to tasks — the article to read, the PR to reply to, the
-- page shared into the app from another app's share sheet. Free text rather
-- than a validated URL: the client normalizes what the user types (trimming it,
-- prepending `https://` when no scheme is present) but never rejects it, so a
-- typo in an optional field can't block saving a task.
--
-- Nullable, no default. No RLS changes are needed — the existing `user_id`
-- policies on `tasks` already cover the new column — and no view, trigger, or
-- function needs updating: `public.search_entries` projects tasks with
-- `to_jsonb(t)` rather than a column list, and the seed/archive routines that
-- do list columns already omit every other nullable one.
--
-- `repeat_task_templates` deliberately gets no counterpart. A link belongs to
-- the thing a task is about, not to the schedule that mints occurrences of it —
-- the same reason `due_on` has no template counterpart either.

alter table public.tasks
  add column if not exists url text;
