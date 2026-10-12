CREATE OR REPLACE FUNCTION public.create_user_preferences()
  RETURNS TRIGGER
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

GRANT EXECUTE ON FUNCTION "public"."create_user_preferences"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."create_user_preferences"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_user_preferences"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_user_preferences"() TO "postgres";
