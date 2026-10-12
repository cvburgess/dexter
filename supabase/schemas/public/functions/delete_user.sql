CREATE OR REPLACE FUNCTION public.delete_user()
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth'
  AS $function$
	--delete from public.profiles where id = auth.uid();
	delete from auth.users where id = auth.uid();
$function$;

GRANT EXECUTE ON FUNCTION "public"."delete_user"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."delete_user"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."delete_user"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_user"() TO "postgres";
