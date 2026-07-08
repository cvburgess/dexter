-- DEX-4: Prevent RLS updates from transferring row ownership.
--
-- The production baseline defined every user-owned UPDATE policy with
-- `using ((select auth.uid()) = user_id)` but a permissive `with check` (either
-- `true`, or -- for repeat_task_templates -- only the cron schedule regex). The
-- USING clause gates the *pre-update* row, but WITH CHECK gates the *post-update*
-- row. With an unrestricted WITH CHECK, an authenticated user can reassign a
-- row's `user_id` to another user (ownership transfer) or point tenant-scoped
-- foreign keys (list_id/goal_id/template_id/subtask_of/habit_id) at rows they do
-- not own. Because the mcp-server edge function and the client SDK both rely on
-- RLS as the sole ownership gate, this is directly exploitable.
--
-- Fix: recreate each UPDATE policy so its WITH CHECK requires post-update
-- ownership (`(select auth.uid()) = user_id`), and -- for tables with
-- tenant-scoped foreign keys -- that any referenced row also belongs to the
-- caller. Postgres cannot alter a policy's WITH CHECK in place, so each policy
-- is dropped and recreated. Nullable FKs are guarded with `is null or exists`.
--
-- Scope: UPDATE policies only, matching the issue. The equivalent cross-owner FK
-- gap on INSERT policies is intentionally left unchanged here.
--
-- Rollback: recreate each policy below with `with check (true)` (and, for
-- repeat_task_templates, `with check (<schedule regex>)`) to restore the
-- baseline behavior.

-- daily_habits: ownership + habit_id must reference a habit owned by the caller
-- (habit_id is NOT NULL, so no null guard is needed).
drop policy "Users can update their own daily habits" on "public"."daily_habits";
create policy "Users can update their own daily habits" on "public"."daily_habits"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check (
    ((( SELECT auth.uid() AS uid) = user_id)
    AND (EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_id AND h.user_id = ( SELECT auth.uid() AS uid))))
  );

-- days: ownership only (no tenant-scoped foreign keys).
drop policy "Users can update their own days" on "public"."days";
create policy "Users can update their own days" on "public"."days"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

-- goals: ownership only.
drop policy "Users can update their own goals" on "public"."goals";
create policy "Users can update their own goals" on "public"."goals"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

-- habits: ownership only.
drop policy "Users can update their own habits" on "public"."habits";
create policy "Users can update their own habits" on "public"."habits"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

-- lists: ownership only.
drop policy "Users can update their own lists" on "public"."lists";
create policy "Users can update their own lists" on "public"."lists"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

-- preferences: ownership only.
drop policy "Users can update their own preferences" on "public"."preferences";
create policy "Users can update their own preferences" on "public"."preferences"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

-- repeat_task_templates: ownership + preserve the cron schedule validation
-- (including its NULL tolerance, matching the INSERT policy) + list_id/goal_id
-- must reference rows owned by the caller (both nullable).
drop policy "Users can update their own valid repeat task templates" on "public"."repeat_task_templates";
create policy "Users can update their own valid repeat task templates" on "public"."repeat_task_templates"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check (
    ((( SELECT auth.uid() AS uid) = user_id)
    AND ((schedule IS NULL) OR ((schedule)::text ~ '^0 0 (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*) (\*|([1-9]|1[0-2])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*) (\*|([0-7])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*)$'::text))
    AND ((list_id IS NULL) OR (EXISTS (
      SELECT 1 FROM public.lists l
      WHERE l.id = list_id AND l.user_id = ( SELECT auth.uid() AS uid))))
    AND ((goal_id IS NULL) OR (EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_id AND g.user_id = ( SELECT auth.uid() AS uid)))))
  );

-- tasks: ownership + list_id/goal_id/template_id/subtask_of must reference rows
-- owned by the caller (all nullable).
drop policy "Users can update their own tasks" on "public"."tasks";
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
      WHERE t.id = template_id AND t.user_id = ( SELECT auth.uid() AS uid))))
    AND ((subtask_of IS NULL) OR (EXISTS (
      SELECT 1 FROM public.tasks p
      WHERE p.id = subtask_of AND p.user_id = ( SELECT auth.uid() AS uid)))))
  );
