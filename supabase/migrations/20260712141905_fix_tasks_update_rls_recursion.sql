-- DEX-32: Fix infinite recursion (42P17) in the tasks UPDATE RLS policy.
--
-- DEX-4 (20260708040856_rls_update_ownership_with_check.sql) rewrote the tasks
-- UPDATE policy's WITH CHECK to confirm tenant-scoped foreign keys reference
-- rows the caller owns. For list_id/goal_id/template_id this is safe because the
-- sub-selects target *other* tables. But the subtask_of guard sub-selected from
-- `public.tasks` itself:
--
--   AND ((subtask_of IS NULL) OR (EXISTS (
--     SELECT 1 FROM public.tasks p
--     WHERE p.id = subtask_of AND p.user_id = ( SELECT auth.uid() AS uid))))
--
-- A policy on `tasks` that queries `tasks` makes Postgres recursively re-apply
-- the tasks policies while evaluating the sub-select, raising
-- `42P17 infinite recursion detected in policy for relation "tasks"`. This broke
-- every UPDATE on tasks (edit, complete, reschedule, reorder) and any cascade
-- UPDATE such as goal/list archiving (update_tasks_on_goal_archive /
-- update_tasks_on_list_archive run under the caller's RLS).
--
-- Fix: recreate the tasks UPDATE policy, preserving DEX-4's ownership guarantees
-- (post-update user_id ownership + list_id/goal_id/template_id FK-ownership
-- checks against other tables) but DROPPING the self-referential subtask_of
-- sub-select entirely. A table's own policy cannot inline-query that same table
-- without recursing, so self-referential FKs like subtask_of cannot be guarded
-- this way. If cross-owner protection for subtask_of is ever required, implement
-- it via a SECURITY DEFINER owner-lookup function (which bypasses RLS and so
-- does not recurse), matching the baseline's existing SECURITY DEFINER
-- functions -- do not reintroduce the inline `from public.tasks` sub-select.
--
-- The USING clause still restricts UPDATEs to rows the caller owns, so this only
-- relaxes the (post-DEX-4) guard against re-parenting one's own task under
-- another user's task; subtask_of is a self-FK with ON DELETE CASCADE.
--
-- Rollback: recreate the policy with the DEX-4 WITH CHECK (including the
-- subtask_of sub-select) to restore the recursive -- and broken -- behavior.

drop policy if exists "Users can update their own tasks" on "public"."tasks";
create policy "Users can update their own tasks" on "public"."tasks"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check (
    ((( SELECT auth.uid() AS uid) = user_id)
    AND ((list_id IS NULL) OR (EXISTS (
      SELECT 1 FROM public.lists l
      WHERE l.id = list_id AND l.user_id = ( SELECT auth.uid() AS uid))))
    AND ((goal_id IS NULL) OR (EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_id AND g.user_id = ( SELECT auth.uid() AS uid))))
    AND ((template_id IS NULL) OR (EXISTS (
      SELECT 1 FROM public.repeat_task_templates t
      WHERE t.id = template_id AND t.user_id = ( SELECT auth.uid() AS uid)))))
  );
