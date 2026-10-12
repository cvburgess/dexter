CREATE OR REPLACE FUNCTION public.create_default_user_tasks()
  RETURNS TRIGGER
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

GRANT EXECUTE ON FUNCTION "public"."create_default_user_tasks"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."create_default_user_tasks"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_default_user_tasks"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_default_user_tasks"() TO "postgres";
