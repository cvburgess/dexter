CREATE OR REPLACE FUNCTION public.handle_habits_changes()
  RETURNS TRIGGER
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

GRANT EXECUTE ON FUNCTION "public"."handle_habits_changes"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."handle_habits_changes"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."handle_habits_changes"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_habits_changes"() TO "postgres";
