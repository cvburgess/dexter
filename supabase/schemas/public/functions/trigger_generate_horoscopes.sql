CREATE OR REPLACE FUNCTION public.trigger_generate_horoscopes()
  RETURNS bigint
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets
      where name = 'generate_horoscopes_url';

    select decrypted_secret into v_secret
      from vault.decrypted_secrets
      where name = 'generate_horoscopes_secret';
  exception
    when others then
      -- Three shapes of "not configured here", all benign: no `vault` schema at
      -- all, no SELECT privilege on the view, or a secret this project's key
      -- cannot decrypt (a dump restored elsewhere).
      raise warning 'DEX-84: vault is unreadable (% %); skipping horoscope generation.',
        sqlstate, sqlerrm;
      return null;
  end;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise notice 'DEX-84: generate_horoscopes_url/_secret are not provisioned here; skipping.';
    return null;
  end if;

  -- Returns a request id immediately; the pg_net background worker performs the
  -- POST. The returned id is what joins to `net._http_response`, which makes
  -- `select public.trigger_generate_horoscopes();` a complete manual smoke test:
  -- NULL means unprovisioned, a number means enqueued.
  select net.http_post(
    url := v_url,
    body := jsonb_build_object('source', 'pg_cron'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

COMMENT ON FUNCTION "public"."trigger_generate_horoscopes"() IS 'DEX-84: POSTs the generate-horoscopes Edge Function. Endpoint and shared secret come from Vault (generate_horoscopes_url / generate_horoscopes_secret) so this is live on production and inert on preview branches and locally. Returns the pg_net request id, or NULL when unprovisioned.';

REVOKE ALL ON FUNCTION "public"."trigger_generate_horoscopes"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."trigger_generate_horoscopes"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."trigger_generate_horoscopes"() FROM PUBLIC, "anon", "authenticated", "service_role";
