-- DEX-84: Schedule the daily horoscope generation.
--
-- A pg_cron job fires `public.trigger_generate_horoscopes()` once a day, which
-- POSTs to the `generate-horoscopes` Edge Function via pg_net. The function
-- fetches tomorrow's prediction for all twelve signs and upserts them into
-- `public.horoscopes` (20260804005118_add_horoscopes.sql).
--
-- This is the repo's first use of pg_cron, pg_net, and Vault, so most of this
-- file is about the traps rather than the twelve lines of actual work.
--
-- ── No URL in this file, ever ──────────────────────────────────────────────
-- Supabase preview branches replay every migration against a *different*
-- project ref. A hardcoded production URL here would therefore put every open
-- pull request's branch database on a daily timer pointed at production. The
-- endpoint and the shared secret live in Vault instead, which is per-project
-- and never in git. `__tests__/migrations/schedule_generate_horoscopes.test.ts`
-- asserts that the executable SQL below contains no URL, because this is the
-- one regression in this file that would cost real money.
--
-- The consequence is that the job is scheduled *everywhere* and inert almost
-- everywhere: on every preview branch and every local `supabase db reset` it
-- finds an empty Vault and returns NULL without making a request. That is the
-- design. Do not "fix" the no-op.
--
-- A dump restored into a different project gets the same treatment for free:
-- the Vault root key is project-scoped, so the secrets cannot be decrypted
-- there and the read raises — which the handler below turns into the same skip.
--
-- ── Why 06:00 UTC ─────────────────────────────────────────────────────────
-- The window is bounded on both sides and anyone moving this should stay inside
-- 05:00–09:00 UTC.
--   * Above 10:00 UTC you miss the deadline. The earliest local midnight on
--     Earth is UTC+14, which enters date D at 10:00 UTC on D-1 — and D is what
--     this run generates.
--   * Below ~05:00 UTC the UTC date and a US-eastern-computed "today" disagree,
--     so the upstream `/daily/next/` could return the day already stored. This
--     is the DEX-117 hazard (docs/backend.md "Deployment") from the other
--     direction.
-- pg_cron reads `cron.timezone`, which defaults to GMT and is UTC on Supabase.
-- Worth a `show cron.timezone;` after deploying rather than assuming.
--
-- ── Known limitation, recorded rather than solved ─────────────────────────
-- Local "tomorrow" spans UTC_date through UTC_date+2 across all offsets, so a
-- single next-day fetch structurally cannot cover UTC+13/+14: a Kiribati user at
-- 00:01 local wants a horoscope that will not exist for another ~20 hours. The
-- row's `date` is whatever the API reports in `prediction_date`, and the
-- consuming UI should resolve "today" against that same UTC-ish date. Revisit
-- if the upstream grows a date parameter, or if Dexter grows users past UTC+12.
--
-- ── Operational notes ─────────────────────────────────────────────────────
-- * pg_net is asynchronous. A `succeeded` row in `cron.job_run_details` means
--   the POST was *enqueued*, nothing more — a 500, a 404, a DNS failure all
--   look identical there. The real outcome is in `net._http_response`, which
--   has a ~6 hour TTL, or in the data itself.
-- * pg_net's `timeout_milliseconds` does not cancel the Edge Function, so
--   `timed_out = true` can coexist with a fully successful generation. That is
--   why the function is idempotent and why a naive retry must not be added.
-- * Rotation is paired: the Vault `generate_horoscopes_secret` and the
--   `HOROSCOPE_CRON_SECRET` function secret must change together or the job
--   401s silently every morning — the same failure shape docs/backend.md
--   documents for DEMO_OTP.
-- * This migration manages only the job named below. Renaming it orphans the
--   old one, which needs a manual `cron.unschedule` on production.
--
-- Provisioning production (one time, *after* the function is deployed) and the
-- full runbook are in docs/backend.md "Scheduled jobs (pg_cron)".
--
-- Rollback:
--   select cron.unschedule('dex84-generate-horoscopes');
--   drop function if exists public.trigger_generate_horoscopes();
--   -- leave pg_cron/pg_net installed; other objects may come to depend on them.

-- Deliberately no `with schema`, unlike the baseline's pgcrypto/uuid-ossp. Both
-- extensions are non-relocatable and create their own `cron` / `net` schemas
-- from inside their install scripts, so naming one is at best ignored.
--
-- Guarded so a Postgres without the `shared_preload_libraries` entry — some
-- local Docker images — degrades to a warning instead of failing `db reset`.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise warning 'DEX-84: pg_cron is unavailable; the daily horoscope job will not be scheduled.';
    return;
  end if;
  create extension if not exists pg_cron;
exception
  when others then
    raise warning 'DEX-84: could not create pg_cron (% %); the daily horoscope job will not be scheduled.',
      sqlstate, sqlerrm;
end $$;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise warning 'DEX-84: pg_net is unavailable; trigger_generate_horoscopes() will fail when called.';
    return;
  end if;
  create extension if not exists pg_net;
exception
  when others then
    raise warning 'DEX-84: could not create pg_net (% %).', sqlstate, sqlerrm;
end $$;

-- `security invoker`, not definer. pg_cron records the scheduling role and runs
-- the command as that role — `postgres` here, which already has SELECT on
-- `vault.decrypted_secrets`. Invoker rights therefore work for the cron path
-- while failing closed for everyone else: even if a future migration re-granted
-- EXECUTE, a non-`postgres` caller would hit a permission error on the Vault
-- view rather than get a free paid-quota trigger.
--
-- `set search_path = ''` (rather than this schema's usual `'public', 'pg_temp'`)
-- because every reference in the body is schema-qualified or in pg_catalog.
--
-- plpgsql resolves `vault.*` and `net.*` at call time, not creation time, which
-- is why this statement needs no guard of its own even where pg_net is absent.
create or replace function public.trigger_generate_horoscopes()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
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

comment on function public.trigger_generate_horoscopes() is
  'DEX-84: POSTs the generate-horoscopes Edge Function. Endpoint and shared secret come from Vault (generate_horoscopes_url / generate_horoscopes_secret) so this is live on production and inert on preview branches and locally. Returns the pg_net request id, or NULL when unprovisioned.';

-- Functions in `public` are EXECUTE-able by PUBLIC by default, and `public` is
-- PostgREST-exposed. Without this revoke, every signed-in user — and, with the
-- publishable key that ships inside the app bundle, every anonymous visitor —
-- could POST /rest/v1/rpc/trigger_generate_horoscopes and spend paid API and LLM
-- quota on demand. Only the owner (`postgres`), which is who pg_cron runs the
-- job as, may execute it. Do not grant this to `authenticated`.
revoke all on function public.trigger_generate_horoscopes() from public;
revoke all on function public.trigger_generate_horoscopes() from anon, authenticated, service_role;

-- Tagged `$do$` rather than the bare `$$` used elsewhere in this file, because
-- the body nests another dollar-quoted string. Dollar-quoting is lexical and
-- knows nothing about comments, so a bare pair of dollar signs anywhere in here
-- — including inside a `--` comment — would close the block early and leave the
-- remainder as a syntax error.
do $do$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise warning 'DEX-84: pg_cron is not installed; skipping cron.schedule.';
    return;
  end if;

  -- The named three-argument `cron.schedule(name, schedule, command)` already
  -- upserts on (jobname, username), while the two-argument form silently
  -- inserts a duplicate on every replay — always use the named form here.
  -- Unscheduling first makes that unconditional and also collapses a job
  -- somebody created by hand in the SQL editor. Scoped to `current_user`
  -- because `cron.unschedule` raises on another role's job.
  perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'dex84-generate-horoscopes'
      and username = current_user;

  perform cron.schedule(
    'dex84-generate-horoscopes',
    '0 6 * * *',
    $cron$select public.trigger_generate_horoscopes();$cron$
  );
end $do$;
-- No exception handler on that block, deliberately. The pg_extension guard
-- already covers the only case that must not fail `db reset`. Anything else — a
-- permission error on `cron`, a signature change — is a real defect that should
-- fail the migrate job loudly, not surface a week later as missing horoscopes.
