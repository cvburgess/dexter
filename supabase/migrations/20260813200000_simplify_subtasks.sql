-- DEX-153: Subtasks are complete or incomplete
--
-- Subtasks shipped (DEX-70) carrying `ETaskStatus` — the same five-member enum a
-- task has — so a checklist item could be in-progress, won't-do, or delegated.
-- They are a checklist, not small tasks: the item shape becomes `{id, title,
-- done}`. The five statuses survive only at the boundary, where promoting a
-- subtask to a real task maps done -> DONE and not-done -> TODO.
--
-- Data-only. `subtasks` is untyped jsonb, so there is no column to alter and
-- `tasks_subtasks_is_array` still holds. `repeat_task_templates.subtasks` is
-- untouched: a template's checklist is a blueprint and was always `{id, title}`.
--
-- Readers coerce rather than reject on the way in (`withSubtasksArray` in the
-- app, `storedSubtasksSchema` in the MCP server), which is what covers the skew
-- this migration cannot: an app bundle predating the change keeps writing
-- `status` until its user updates. That also makes this safe to re-run — an
-- item that already has `done` keeps it.

update public.tasks
set subtasks = coalesce((
  select jsonb_agg(
    jsonb_build_object(
      'id', item ->> 'id',
      'title', item ->> 'title',
      -- ETaskStatus: DONE=2, WONT_DO=3, DELEGATED=4 (src/utils/taskStatus.ts).
      -- Spelled out because a migration cannot import the enum; the numbering is
      -- persisted data under an append-only rule, so it cannot shift underneath
      -- this. Every terminal status maps to done — a won't-do parent's checklist
      -- was already swept to won't-do, and two states leave nowhere else for it.
      'done', coalesce(
        (item -> 'done')::boolean,
        (item ->> 'status')::int = any (array[2, 3, 4]),
        false
      )
    )
    order by ordinality
  )
  from jsonb_array_elements(subtasks) with ordinality as t(item, ordinality)
), '[]'::jsonb)
where subtasks <> '[]'::jsonb;
