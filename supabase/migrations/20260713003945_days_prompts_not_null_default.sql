-- Make public.days.prompts NOT NULL with a default of '[]'.
--
-- The `days` table is shared by two independent apps against the same Supabase
-- project: the new Expo app (this repo) and the legacy Electron/web app
-- (github.com/cvburgess/dexter-app). The production baseline defined
-- `days.prompts jsonb` as nullable with no default.
--
-- The new app's Notes feature (DEX-37) saves a day via `upsertDay({ notes })`
-- with no `prompts`, so the first note written for a day INSERTs a row with
-- `prompts = NULL`. The legacy app then renders that shared row with
-- `prompts.map(...)` and no null guard (dexter-app Journal.tsx), crashing with
-- `TypeError: Cannot read properties of null (reading 'map')`.
--
-- Fix: backfill the existing null rows, then make the column NOT NULL with a
-- '[]' default so no client can reintroduce the crash. A column invariant is
-- the only place that protects both apps regardless of which one writes.
--
-- Rollback: `alter table public.days alter column prompts drop not null;`
-- and `alter table public.days alter column prompts drop default;`
-- (existing '[]' values are harmless and need not be reverted).

update public.days set prompts = '[]'::jsonb where prompts is null;

alter table public.days alter column prompts set default '[]'::jsonb;
alter table public.days alter column prompts set not null;
