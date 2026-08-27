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

// The Ritual tab (DEX-127/DEX-34): a thin selector owning the one
// TRitualState (rules live in utils/ritualSteps); branches inside the screen.
export default function RitualScreen() {
  const multiPane = useIsLargeDevice();
  const [preferences] = usePreferences();
  // `?date=&mode=&step=&n=` deep-link contract (utils/ritualRoute.ts,
  // DEX-105); typed loosely since a repeated key hands back a string[].
  const params = useLocalSearchParams<{
    date?: string | string[];
    mode?: string | string[];
    step?: string | string[];
    n?: string | string[];
  }>();
  const link = parseRitualLink(params);
  const today = useToday();

  // Whether `mode`'s ritual has a Journal step: the preference plus its own
  // prompts (DEX-151).
  const journalStepEnabled = (mode: TRitualMode) =>
    preferences.enableJournal &&
    hasPromptsFor(preferences.templatePrompts, mode);

  // Clock read on mount, not module load. Link applied here too — tab screens
  // mount lazily, so a change-only adjustment misses the first followed link.
  const [state, setState] = useState(() => {
    // A link's mode wins, or withLink lands on a step this ritual hasn't got.
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

  // So "New Task" from this tab defaults to the viewed day, the Today/Week
  // contract — a followed journal link keeps that default until navigation.
  usePublishViewedDay(state.date);

  // The oldest day the ritual *reads*: Preview tomorrow compares against
  // weekdays up to four weeks back, which would otherwise fetch as zero.
  useExpandTaskReach(oldestDayRead(state.date));

  // Follow midnight rollover (DEX-161) only while on the day that ended. A
  // whole new state, not withDate — a new day is a new walk (mode, step 0).
  const [lastToday, setLastToday] = useState(today);
  if (!today.equals(lastToday)) {
    setLastToday(today);
    if (state.date.equals(lastToday)) {
      setState((current) => {
        const mode = currentRitualMode();
        return createRitualState(today, mode, {
          // Re-derived, not carried: per-ritual, and a rollover can cross modes.
          journalEnabled: journalStepEnabled(mode),
          calendarEnabled: current.calendarEnabled,
          horoscopeEnabled: current.horoscopeEnabled,
        });
      });
    }
  }

  // Follow a link arriving after mount, adjusted during render so the wrong
  // step never paints for a frame; keyed on link.id so a re-follow lands.
  const [appliedLinkId, setAppliedLinkId] = useState(link?.id ?? null);
  if ((link?.id ?? null) !== appliedLinkId) {
    setAppliedLinkId(link?.id ?? null);
    if (link) setState((current) => withLink(current, link));
  }

  // Follow prefs toggled elsewhere; withXEnabled keeps the step by id, so a
  // cold-launch correction is unremarkable. Journal also follows mode.
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
