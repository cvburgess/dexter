-- DEX-72: Custom alarm sound
--
-- Which sound a task alarm rings with. The value names an entry in the app's
-- `ALARM_SOUNDS` registry (`src/utils/alarms.shared.ts`), not a file path — the
-- audio itself is bundled into the iOS app at prebuild, so the DB only records
-- the choice. `'system'` means "leave AlarmKit on its own default sound".
--
-- Defaults to `'echos'` so existing and new users alike get Dexter's sound and
-- can opt back out from Settings → Tasks. Deliberately no CHECK constraint: the
-- set of sounds is app-owned and expected to grow, and a client that doesn't
-- recognize a stored value already falls back to the default sound.
--
-- No RLS changes are needed — the existing `user_id` policies on `preferences`
-- already cover the new column.

alter table public.preferences
  add column if not exists alarm_sound text not null default 'echos';
