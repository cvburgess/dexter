-- DEX-142: Horoscope on/off
--
-- Whether the Ritual tab's morning walk includes its Horoscope step (DEX-128).
-- The `horoscopes` rows themselves are global reference data generated for all
-- twelve signs nightly, so this column changes nothing about what is generated
-- — only whether this user is walked through it. Joins `enable_journal` and
-- `enable_calendar` as a step-level toggle; `src/utils/ritualSteps.ts` maps each
-- to the step it keeps.
--
-- Defaults to `true` because the step shipped on for everyone in DEX-128, and
-- any other default would silently remove a step from users who have been using
-- it. Note the contrast with `enable_calendar`, which defaults to false: that
-- asymmetry is why the two corrections run in opposite directions on a cold
-- launch, and it is deliberate in both cases.
--
-- NOT NULL for the same reason as the other `enable_*` columns: every read path
-- treats these as plain booleans without null-guarding, and "unset" is not a
-- meaningful third state for a step that either appears or doesn't. The default
-- is stored in the catalog rather than written to every row, so this does not
-- rewrite the table.
--
-- No RLS changes are needed — the existing `user_id` policies on `preferences`
-- already cover the new column.
--
-- Rollback:
--   alter table public.preferences drop column if exists enable_horoscope;

alter table public.preferences
  add column if not exists enable_horoscope boolean not null default true;
