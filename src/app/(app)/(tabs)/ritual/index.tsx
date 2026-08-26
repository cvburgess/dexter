import { Temporal } from "@js-temporal/polyfill";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { LargeScreenRitual } from "@/components/LargeScreenRitual";
import { SmallScreenRitual } from "@/components/SmallScreenRitual";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { useExpandTaskReach } from "@/hooks/useTaskReach";
import { useToday } from "@/hooks/useToday";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import { hasPromptsFor } from "@/utils/journalPrompts";
import { parseRitualLink } from "@/utils/ritualRoute";
import { oldestDayRead } from "@/utils/tomorrowPreview";
import {
  advanceStep,
  createRitualState,
  currentRitualMode,
  goToStep,
  otherMode,
  withCalendarEnabled,
  withDate,
  withHoroscopeEnabled,
  withJournalEnabled,
  withLink,
  withMode,
} from "@/utils/ritualSteps";
import type { TRitualMode } from "@/utils/ritualSteps";

/**
 * The Ritual tab (DEX-127, part of DEX-34) — a guided walk through the start or
 * end of a day, one step at a time.
 *
 * A thin selector, the same role `today/index.tsx` plays: it owns the single
 * `TRitualState` and hands it to whichever layout fits the screen. Every
 * transition lives in `utils/ritualSteps`, so this file holds no rules of its
 * own — and one state means one ritual, whatever the window size, rather than a
 * second copy living in a modal somewhere.
 *
 * Both layouts render at every width, and the branch is inside the screen
 * rather than in the navigator, so a tablet crossing the breakpoint live (a
 * rotation, or a Split View resize) swaps layouts without losing its place.
 */
export default function RitualScreen() {
  const multiPane = useIsLargeDevice();
  const [preferences] = usePreferences();
  // `?date=&mode=&step=&n=` — the deep-link contract a journal search result
  // builds (`utils/ritualRoute.ts`, DEX-105). Null for an ordinary tab press.
  // Typed loosely on purpose: `useLocalSearchParams` hands back a `string[]` for
  // a repeated key, so `parseRitualLink` narrows rather than trusting the shape.
  const params = useLocalSearchParams<{
    date?: string | string[];
    mode?: string | string[];
    step?: string | string[];
    n?: string | string[];
  }>();
  const link = parseRitualLink(params);
  const today = useToday();

  // Whether `mode`'s ritual has a Journal step: the preference, and prompts of
  // its own (DEX-151). A narrower value for `ritualSteps`' existing toggle.
  const journalStepEnabled = (mode: TRitualMode) =>
    preferences.enableJournal &&
    hasPromptsFor(preferences.templatePrompts, mode);

  // Seeded inside the initializer so the clock is read on mount rather than at
  // module load — an app launched in the morning and left open must not still
  // be offering the morning ritual after noon has passed on a fresh open.
  //
  // The link is applied here too, not only in the adjustment below: tab screens
  // mount lazily, so the *first* search result followed in a session mounts
  // this screen with its params already present, and an adjustment that only
  // fires on a change would never run. It would then work on every later tap,
  // which is the worst possible shape for the bug.
  const [state, setState] = useState(() => {
    // Resolved here so the journal flag is seeded for the ritual actually being
    // shown; a link's mode wins, or `withLink` lands on a step it hasn't got.
    const mode = link?.mode ?? currentRitualMode();
    return withLink(
      createRitualState(undefined, mode, {
        journalEnabled: journalStepEnabled(mode),
        calendarEnabled: preferences.enableCalendar,
        horoscopeEnabled: preferences.enableHoroscope,
      }),
      link ?? { date: null, mode: null, step: null },
    );
  });

  // So "New Task" opened from this tab defaults its schedule to the viewed day,
  // the same contract Today and Week publish. Following a link to an old
  // journal entry therefore defaults a new task to that day until the user
  // navigates — the Today tab has always behaved this way.
  usePublishViewedDay(state.date);

  // So the Review step reports real completions on a ritual paged past the
  // canonical fetch's reach, rather than zero (DEX-162).
  //
  // The oldest day the ritual *reads*, not the day it shows: Preview tomorrow
  // compares tomorrow's load against the four matching weekdays before it
  // (`matchingWeekdaysBefore`), and those samples sit up to four weeks earlier
  // than the ritual's own date. Expanding only for `state.date` would leave them
  // outside the fetch, where they count as zero and quietly report every old
  // day as busier than typical.
  useExpandTaskReach(oldestDayRead(state.date));

  // Follow the day changing under the screen — foregrounded after midnight, or
  // left open across it (DEX-161) — and only while the ritual is on the day
  // that just ended, so paging back to an old journal entry survives it.
  //
  // A whole new state rather than `withDate`: a new day is a new walk, so it
  // re-derives the mode from the clock and starts at step 0, exactly what a
  // force-quit produced before this existed. The toggles are carried across
  // rather than re-read from preferences so the corrections below stay no-ops.
  const [lastToday, setLastToday] = useState(today);
  if (!today.equals(lastToday)) {
    setLastToday(today);
    if (state.date.equals(lastToday)) {
      setState((current) => {
        const mode = currentRitualMode();
        return createRitualState(today, mode, {
          // Re-derived, not carried: the flag is per-ritual, and a rollover can
          // cross into the other one.
          journalEnabled: journalStepEnabled(mode),
          calendarEnabled: current.calendarEnabled,
          horoscopeEnabled: current.horoscopeEnabled,
        });
      });
    }
  }

  // Follow a link that arrives after mount. Navigating here from Search
  // re-renders this screen with new params rather than remounting it, so the
  // initializer above only covers a cold open. Adjusted during render (React's
  // supported pattern for deriving state from a changed prop, as
  // `today/index.tsx` does) rather than in an effect, so the ritual never
  // renders the wrong step for a frame first. `appliedLinkId` is what makes it
  // fire once per navigation; it keys on `link.id` rather than the contents so
  // re-following a link the user has since navigated away from still lands.
  const [appliedLinkId, setAppliedLinkId] = useState(link?.id ?? null);
  if ((link?.id ?? null) !== appliedLinkId) {
    setAppliedLinkId(link?.id ?? null);
    if (link) setState((current) => withLink(current, link));
  }

  // Follow the journal, calendar and horoscope preferences, each toggled in
  // another tab while this screen stays mounted. `usePreferences` serves
  // defaults until the row loads, so each corrects a moment after mount on a
  // cold launch — and not all in the same direction, since the journal and
  // horoscope default on while the calendar defaults off. Each `withXEnabled`
  // keeps the user on the same step by id, which is what makes the corrections
  // unremarkable. One `if` per preference, and deliberately not merged: they
  // change independently, and each transition already returns its input when
  // its own flag hasn't moved.
  // The journal's also follows the **mode**, so AM↔PM can add or drop the step.
  // Read `current.mode` inside the updater to survive the stale-state pass.
  if (state.journalEnabled !== journalStepEnabled(state.mode)) {
    setState((current) =>
      withJournalEnabled(current, journalStepEnabled(current.mode)),
    );
  }
  if (state.calendarEnabled !== preferences.enableCalendar) {
    setState((current) =>
      withCalendarEnabled(current, preferences.enableCalendar),
    );
  }
  if (state.horoscopeEnabled !== preferences.enableHoroscope) {
    setState((current) =>
      withHoroscopeEnabled(current, preferences.enableHoroscope),
    );
  }

  const changeDate = (date: Temporal.PlainDate) =>
    setState((current) => withDate(current, date));
  const toggleMode = () =>
    setState((current) => withMode(current, otherMode(current.mode)));
  const selectStep = (index: number) =>
    setState((current) => goToStep(current, index));
  const swipe = (direction: 1 | -1) =>
    setState((current) => advanceStep(current, direction));

  return multiPane ? (
    <LargeScreenRitual
      onChangeDate={changeDate}
      onSelectStep={selectStep}
      onSwipe={swipe}
      onToggleMode={toggleMode}
      state={state}
    />
  ) : (
    <SmallScreenRitual
      onChangeDate={changeDate}
      onSelectStep={selectStep}
      onSwipe={swipe}
      onToggleMode={toggleMode}
      state={state}
    />
  );
}
