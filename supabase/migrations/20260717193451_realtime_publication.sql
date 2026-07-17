-- Adds the eight user-owned tables to the supabase_realtime publication so
-- Postgres emits change events for client cache invalidation (DEX-36).
-- Clients treat events as invalidation signals only — payloads are never used
-- as data (RLS still gates what refetches return; DELETE payloads carry only
-- PKs). Guarded per-table: the hosted project's publication is
-- dashboard-managed state that may already include some tables.
--
-- Rollback: alter publication supabase_realtime drop table public.<name>;
-- (repeat per table listed below).

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array[
    'daily_habits', 'days', 'goals', 'habits',
    'lists', 'preferences', 'repeat_task_templates', 'tasks'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
