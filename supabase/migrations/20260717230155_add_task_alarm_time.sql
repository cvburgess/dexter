-- DEX-48: Notifications / Alarms
--
-- Adds an optional time-of-day alarm to tasks. The alarm fires at the task's
-- `scheduled_for` date combined with `alarm_time` (native iOS AlarmKit does the
-- ringing client-side; the DB is the source of truth). Repeat schedules carry
-- their own `alarm_time` so each generated occurrence inherits the alarm.
--
-- Both columns are nullable time-of-day values. No RLS changes are needed — the
-- existing `user_id` policies on these tables already cover the new column, and
-- the `repeat_task_templates` schedule CHECK constraint is independent of it.

alter table public.tasks
  add column if not exists alarm_time time;

alter table public.repeat_task_templates
  add column if not exists alarm_time time;
