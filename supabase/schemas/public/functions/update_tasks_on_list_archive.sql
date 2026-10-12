CREATE OR REPLACE FUNCTION public.update_tasks_on_list_archive()
  RETURNS TRIGGER
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

GRANT EXECUTE ON FUNCTION "public"."update_tasks_on_list_archive"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."update_tasks_on_list_archive"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_tasks_on_list_archive"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."update_tasks_on_list_archive"() TO "postgres";
