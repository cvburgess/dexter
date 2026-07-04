-- Production baseline pulled from Supabase project isreileykodwkyedcewv.

create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

set search_path = "public", "extensions";

create table if not exists "public"."daily_habits" (
  "date" date not null,
  "user_id" uuid default auth.uid() not null,
  "habit_id" uuid not null,
  "steps" smallint not null,
  "steps_complete" smallint default '0'::smallint not null,
  "percent_complete" integer generated always as (((100)::numeric * ((steps_complete)::numeric / (steps)::numeric))) stored
);

create table if not exists "public"."days" (
  "date" date default now() not null,
  "user_id" uuid default auth.uid() not null,
  "notes" text default ''::text,
  "prompts" jsonb
);

create table if not exists "public"."goals" (
  "id" uuid default gen_random_uuid() not null,
  "created_at" timestamp with time zone default now() not null,
  "title" character varying default ''::character varying,
  "user_id" uuid default auth.uid() not null,
  "is_archived" boolean default false not null
);

create table if not exists "public"."habits" (
  "id" uuid default gen_random_uuid() not null,
  "created_at" timestamp with time zone default now() not null,
  "user_id" uuid default auth.uid() not null,
  "title" character varying not null,
  "emoji" character varying not null,
  "steps" smallint not null,
  "days_active" smallint[] not null,
  "is_archived" boolean default false not null,
  "is_paused" boolean default false not null
);

create table if not exists "public"."lists" (
  "id" uuid default gen_random_uuid() not null,
  "created_at" timestamp with time zone default now() not null,
  "title" character varying default ''::character varying,
  "emoji" character varying not null,
  "user_id" uuid default auth.uid() not null,
  "is_archived" boolean default false not null
);

create table if not exists "public"."preferences" (
  "user_id" uuid default auth.uid() not null,
  "light_theme" character varying default 'dexter'::character varying not null,
  "dark_theme" character varying default 'dark'::character varying not null,
  "theme_mode" smallint default '0'::smallint not null,
  "template_note" text default ''::text not null,
  "enable_notes" boolean default true not null,
  "enable_journal" boolean default true not null,
  "template_prompts" character varying[] default ARRAY['Yesterday''s highlight'::text, 'Today I am grateful for'::text, 'Today I am excited for'::text, 'What matters most today'::text] not null,
  "enable_habits" boolean default true not null,
  "calendar_urls" character varying[] default ARRAY[]::character varying[] not null,
  "enable_calendar" boolean default false not null,
  "calendar_start_time" time without time zone default '06:00:00'::time without time zone not null,
  "calendar_end_time" time without time zone default '20:00:00'::time without time zone not null
);

create table if not exists "public"."repeat_task_templates" (
  "id" uuid default gen_random_uuid() not null,
  "created_at" timestamp with time zone default now() not null,
  "schedule" character varying default '0 0 * * *'::character varying not null,
  "title" character varying default ''::character varying not null,
  "priority" smallint default '4'::smallint not null,
  "list_id" uuid,
  "user_id" uuid default auth.uid() not null,
  "goal_id" uuid
);

create table if not exists "public"."tasks" (
  "id" uuid default gen_random_uuid() not null,
  "title" character varying(100) default ''::character varying not null,
  "due_on" date,
  "scheduled_for" date,
  "priority" smallint default 4 not null,
  "status" smallint default '1'::smallint not null,
  "subtask_of" uuid,
  "created_at" timestamp without time zone default now() not null,
  "list_id" uuid,
  "user_id" uuid default auth.uid() not null,
  "goal_id" uuid,
  "template_id" uuid
);

-- Primary keys first: foreign keys below reference them, and Postgres
-- requires the referenced unique constraint to exist before the FK is added.
alter table only "public"."daily_habits" add constraint "daily_habits_pkey" PRIMARY KEY (date, habit_id);
alter table only "public"."days" add constraint "days_pkey" PRIMARY KEY (date, user_id);
alter table only "public"."goals" add constraint "goal_pkey" PRIMARY KEY (id);
alter table only "public"."habits" add constraint "habits_pkey" PRIMARY KEY (id);
alter table only "public"."lists" add constraint "list_pkey" PRIMARY KEY (id);
alter table only "public"."preferences" add constraint "preferences_pkey" PRIMARY KEY (user_id);
alter table only "public"."repeat_task_templates" add constraint "repeat_task_templates_pkey" PRIMARY KEY (id);
alter table only "public"."tasks" add constraint "task_pkey" PRIMARY KEY (id);

alter table only "public"."daily_habits" add constraint "daily_habits_habit_id_fkey" FOREIGN KEY (habit_id) REFERENCES habits(id) ON UPDATE CASCADE ON DELETE CASCADE;
alter table only "public"."daily_habits" add constraint "daily_habits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only "public"."days" add constraint "days_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only "public"."goals" add constraint "goal_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
alter table only "public"."habits" add constraint "habits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only "public"."lists" add constraint "list_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
alter table only "public"."preferences" add constraint "preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only "public"."repeat_task_templates" add constraint "repeat_task_templates_goal_id_fkey" FOREIGN KEY (goal_id) REFERENCES goals(id) ON UPDATE CASCADE ON DELETE SET NULL;
alter table only "public"."repeat_task_templates" add constraint "repeat_task_templates_list_id_fkey" FOREIGN KEY (list_id) REFERENCES lists(id) ON UPDATE CASCADE ON DELETE SET NULL;
alter table only "public"."repeat_task_templates" add constraint "repeat_task_templates_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
alter table only "public"."tasks" add constraint "tasks_goal_id_fkey" FOREIGN KEY (goal_id) REFERENCES goals(id) ON UPDATE CASCADE ON DELETE SET NULL;
alter table only "public"."tasks" add constraint "tasks_list_id_fkey" FOREIGN KEY (list_id) REFERENCES lists(id) ON UPDATE CASCADE ON DELETE SET NULL;
alter table only "public"."tasks" add constraint "tasks_subtask_of_fkey" FOREIGN KEY (subtask_of) REFERENCES tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;
alter table only "public"."tasks" add constraint "tasks_template_id_fkey" FOREIGN KEY (template_id) REFERENCES repeat_task_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;
alter table only "public"."tasks" add constraint "tasks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_daily_habits_habit_id ON public.daily_habits USING btree (habit_id);
CREATE INDEX IF NOT EXISTS idx_daily_habits_user_id ON public.daily_habits USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_days_user_id ON public.days USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON public.lists USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON public.preferences USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_repeat_task_templates_goal_id ON public.repeat_task_templates USING btree (goal_id);
CREATE INDEX IF NOT EXISTS idx_repeat_task_templates_list_id ON public.repeat_task_templates USING btree (list_id);
CREATE INDEX IF NOT EXISTS idx_repeat_task_templates_user_id ON public.repeat_task_templates USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON public.tasks USING btree (goal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON public.tasks USING btree (list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_subtask_of ON public.tasks USING btree (subtask_of);
CREATE INDEX IF NOT EXISTS idx_tasks_template_id ON public.tasks USING btree (template_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks USING btree (user_id);

CREATE OR REPLACE FUNCTION public.create_default_user_tasks()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    today DATE := CURRENT_DATE;
BEGIN
    -- Task 1: Reschedule a task
    INSERT INTO public.tasks (title, priority, scheduled_for, user_id)
    VALUES ('Reschedule this task', 3, today, NEW.id);

    -- Task 2: Mark this task as done
    INSERT INTO public.tasks (title, priority, scheduled_for, due_on, user_id)
    VALUES ('Mark this task as done', 0, today, today, NEW.id);

    -- Task 3: A task due in 3 days
    INSERT INTO public.tasks (title, priority, scheduled_for, due_on, user_id)
    VALUES ('This task is due in 3 days', 1, today, today + 3, NEW.id);

    -- Task 4: Create a habit
    INSERT INTO public.tasks (title, priority, scheduled_for, user_id)
    VALUES ('Create a habit', 2, today, NEW.id);

    -- Task 5: Create a list
    INSERT INTO public.tasks (title, priority, scheduled_for, user_id)
    VALUES ('Create a list', 1, today, NEW.id);

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_next_recurring_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  template_record record;
  next_date date;
  start_date date; -- New variable to track the starting point
BEGIN
  -- Set search path explicitly for security
  SET LOCAL search_path TO public, pg_temp;

  -- Check if status changed to 2 or 3 and has a template_id
  IF (NEW.status IN (2, 3) AND OLD.status NOT IN (2, 3) AND NEW.template_id IS NOT NULL) THEN
    -- Get the template information
    SELECT * INTO template_record 
    FROM public.repeat_task_templates 
    WHERE id = NEW.template_id;

    -- Determine the start date - use the later of current date or scheduled_for date
    start_date := GREATEST(CURRENT_DATE, NEW.scheduled_for);

    -- Parse crontab expression (all at midnight - "0 0 ...")
    DECLARE
      cron_parts text[];
      day_of_month text;
      month text;
      day_of_week text;
      dom_values integer[];
      dow_values integer[];
      check_date date;
      matched boolean;
      i integer;
    BEGIN
      cron_parts := regexp_split_to_array(template_record.schedule, '\s+');

      -- Parse relevant parts (assuming "0 0 DOM MONTH DOW")
      day_of_month := cron_parts[3];
      month := cron_parts[4];
      day_of_week := cron_parts[5];

      -- Start checking from the day after our determined start date
      check_date := start_date + 1;

      -- Try dates for the next 366 days until we find a match
      FOR i IN 1..366 LOOP
        matched := true;

        -- Check day of month (if not wildcard)
        IF day_of_month <> '*' THEN
          -- Handle comma-separated values
          dom_values := ARRAY(
            SELECT TRIM(value)::integer 
            FROM regexp_split_to_table(day_of_month, ',') AS value
          );

          -- Check if current day of month is in our list
          IF NOT (EXTRACT(DAY FROM check_date) = ANY(dom_values)) THEN
            matched := false;
          END IF;
        END IF;

        -- Check month (if not wildcard)
        IF month <> '*' AND matched THEN
          -- Handle comma-separated values for month
          DECLARE 
            month_values integer[];
          BEGIN
            month_values := ARRAY(
              SELECT TRIM(value)::integer 
              FROM regexp_split_to_table(month, ',') AS value
            );

            -- Check if current month is in our list
            IF NOT (EXTRACT(MONTH FROM check_date) = ANY(month_values)) THEN
              matched := false;
            END IF;
          END;
        END IF;

        -- Check day of week (if not wildcard)
        IF day_of_week <> '*' AND matched THEN
          -- Handle comma-separated values
          dow_values := ARRAY(
            SELECT TRIM(value)::integer 
            FROM regexp_split_to_table(day_of_week, ',') AS value
          );

          -- Check if current day of week is in our list
          IF NOT (EXTRACT(DOW FROM check_date) = ANY(dow_values)) THEN
            matched := false;
          END IF;
        END IF;

        -- If all conditions matched, we found our date
        IF matched THEN
          next_date := check_date;
          EXIT;
        END IF;

        -- Try next day
        check_date := check_date + 1;
      END LOOP;

      -- Fallback if no match found
      IF next_date IS NULL THEN
        next_date := start_date + 1;
      END IF;
    END;

    -- Insert new task based on template
    INSERT INTO public.tasks (
      title,
      priority,
      list_id,
      user_id,
      goal_id,
      scheduled_for,
      template_id,
      status
    ) VALUES (
      template_record.title,
      template_record.priority,
      template_record.list_id,
      template_record.user_id,
      template_record.goal_id,
      next_date,
      NEW.template_id,
      1  -- Default status
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_user_preferences()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    INSERT INTO public.preferences (user_id)
    VALUES (NEW.id); 
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_user()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
	--delete from public.profiles where id = auth.uid();
	delete from auth.users where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.handle_habits_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_day_of_week INTEGER;
BEGIN
  -- Set search_path explicitly for security
  SET search_path TO 'public', 'pg_temp';

  -- Get current day of week (1=Monday, 7=Sunday)
  current_day_of_week := EXTRACT(ISODOW FROM CURRENT_DATE);

  -- Case 1: When is_paused or is_archived change from false to true
  IF (OLD.is_paused = FALSE AND NEW.is_paused = TRUE) OR 
     (OLD.is_archived = FALSE AND NEW.is_archived = TRUE) THEN
    DELETE FROM public.daily_habits 
    WHERE habit_id = NEW.id 
    AND date = CURRENT_DATE;
  END IF;

  -- Case 2: When days_active array changes and current day is removed
  IF OLD.days_active <> NEW.days_active AND 
     current_day_of_week = ANY(OLD.days_active) AND 
     NOT (current_day_of_week = ANY(NEW.days_active)) THEN
    DELETE FROM public.daily_habits 
    WHERE habit_id = NEW.id 
    AND date = CURRENT_DATE;
  END IF;

  -- Case 3: When steps is changed
  IF OLD.steps <> NEW.steps THEN
    UPDATE public.daily_habits
    SET steps = NEW.steps,
        steps_complete = LEAST(steps_complete, NEW.steps)
    WHERE habit_id = NEW.id 
    AND date = CURRENT_DATE;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_tasks_on_goal_archive()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if is_archived was changed to true
  IF NEW.is_archived = true AND (OLD.is_archived = false OR OLD.is_archived IS NULL) THEN
    -- Update all related tasks
    UPDATE tasks
    SET status = 3
    WHERE goal_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_tasks_on_list_archive()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if is_archived was changed to true
  IF NEW.is_archived = true AND (OLD.is_archived = false OR OLD.is_archived IS NULL) THEN
    -- Update all related tasks
    UPDATE tasks
    SET status = 3
    WHERE list_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER after_user_insert AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION create_user_preferences();
CREATE TRIGGER create_default_tasks_for_new_user AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION create_default_user_tasks();
CREATE TRIGGER after_goal_archive AFTER UPDATE ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION update_tasks_on_goal_archive();
CREATE TRIGGER habits_changes_trigger AFTER UPDATE ON "public"."habits" FOR EACH ROW EXECUTE FUNCTION handle_habits_changes();
CREATE TRIGGER after_list_archive AFTER UPDATE ON "public"."lists" FOR EACH ROW EXECUTE FUNCTION update_tasks_on_list_archive();
CREATE TRIGGER trigger_create_next_recurring_task AFTER UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION create_next_recurring_task();

alter table "public"."daily_habits" enable row level security;
alter table "public"."days" enable row level security;
alter table "public"."goals" enable row level security;
alter table "public"."habits" enable row level security;
alter table "public"."lists" enable row level security;
alter table "public"."preferences" enable row level security;
alter table "public"."repeat_task_templates" enable row level security;
alter table "public"."tasks" enable row level security;

create policy "Users can delete their own daily habits" on "public"."daily_habits"
  as permissive
  for delete
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can insert their own daily habits" on "public"."daily_habits"
  as permissive
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can read their own daily habits" on "public"."daily_habits"
  as permissive
  for select
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can update their own daily habits" on "public"."daily_habits"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check (true);

create policy "Users can delete their own days" on "public"."days"
  as permissive
  for delete
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can insert their own days" on "public"."days"
  as permissive
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can select their own days" on "public"."days"
  as permissive
  for select
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can update their own days" on "public"."days"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check (true);

create policy "Users can delete their own goals" on "public"."goals"
  as permissive
  for delete
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can insert their own goals" on "public"."goals"
  as permissive
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can select their own goals" on "public"."goals"
  as permissive
  for select
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can update their own goals" on "public"."goals"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check (true);

create policy "Users can delete their own habits" on "public"."habits"
  as permissive
  for delete
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can insert their own habits" on "public"."habits"
  as permissive
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can read their own habits" on "public"."habits"
  as permissive
  for select
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can update their own habits" on "public"."habits"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check (true);

create policy "Users can delete their own lists" on "public"."lists"
  as permissive
  for delete
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can insert their own lists" on "public"."lists"
  as permissive
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can read their own lists" on "public"."lists"
  as permissive
  for select
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can update their own lists" on "public"."lists"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check (true);

create policy "Users can delete their own preferences" on "public"."preferences"
  as permissive
  for delete
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can insert their own preferences" on "public"."preferences"
  as permissive
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can read their own preferences" on "public"."preferences"
  as permissive
  for select
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can update their own preferences" on "public"."preferences"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check (true);

create policy "Users can delete their own repeat_task_templates" on "public"."repeat_task_templates"
  as permissive
  for delete
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can insert their own valid repeat task templates" on "public"."repeat_task_templates"
  as permissive
  for insert
  to "authenticated"
  with check (((( SELECT auth.uid() AS uid) = user_id) AND ((schedule IS NULL) OR ((schedule)::text ~ '^0 0 (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*) (\*|([1-9]|1[0-2])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*) (\*|([0-7])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*)$'::text))));

create policy "Users can read their own repeat task templates" on "public"."repeat_task_templates"
  as permissive
  for select
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can update their own valid repeat task templates" on "public"."repeat_task_templates"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check (((schedule)::text ~ '^0 0 (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*) (\*|([1-9]|1[0-2])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*) (\*|([0-7])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*)$'::text));

create policy "Users can delete their own tasks" on "public"."tasks"
  as permissive
  for delete
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can insert their own tasks" on "public"."tasks"
  as permissive
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can read their own tasks" on "public"."tasks"
  as permissive
  for select
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can update their own tasks" on "public"."tasks"
  as permissive
  for update
  to "authenticated"
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check (true);

grant usage on schema "public" to "anon", "authenticated", "service_role";
grant all on all tables in schema "public" to "anon", "authenticated", "service_role";
grant all on all functions in schema "public" to "anon", "authenticated", "service_role";
