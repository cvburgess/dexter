-- DEX-21: Move recurring-task creation from Postgres to TypeScript.
--
-- The production baseline computed the next occurrence of a repeat task inside a
-- SECURITY DEFINER trigger (`create_next_recurring_task`) that fired AFTER
-- UPDATE on tasks. DEX-21 replaces that SQL cron math with a shared TypeScript
-- helper (`src/utils/repeatSchedule.ts`, backed by croner) invoked by both the
-- Expo app and the mcp-server edge function, so the logic lives in one place and
-- is unit-testable. Drop the trigger and its function; nothing else references
-- them.
--
-- Rollback: restore `create_next_recurring_task()` and
-- `trigger_create_next_recurring_task` from the production baseline migration.

drop trigger if exists "trigger_create_next_recurring_task" on "public"."tasks";
drop function if exists public.create_next_recurring_task();
