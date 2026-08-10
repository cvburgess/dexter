import { Temporal } from "@js-temporal/polyfill";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { LargeScreenRitual } from "@/components/LargeScreenRitual";
import { SmallScreenRitual } from "@/components/SmallScreenRitual";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import { parseRitualLink } from "@/utils/ritualRoute";
import {
  advanceStep,
  createRitualState,
  goToStep,
  otherMode,
  withDate,
  withJournalEnabled,
  withLink,
  withMode,
} from "@/utils/ritualSteps";

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
  // `?date=&step=&n=` — the deep-link contract a journal search result builds
  // (`utils/ritualRoute.ts`, DEX-105). Null for an ordinary tab press. Typed
  // loosely on purpose: `useLocalSearchParams` hands back a `string[]` for a
  // repeated key, so `parseRitualLink` narrows rather than trusting the shape.
  const params = useLocalSearchParams<{
    date?: string | string[];
    step?: string | string[];
    n?: string | string[];
  }>();
  const link = parseRitualLink(params);

  // Seeded inside the initializer so the clock is read on mount rather than at
  // module load — an app launched in the morning and left open must not still
  // be offering the morning ritual after noon has passed on a fresh open.
  //
  // The link is applied here too, not only in the adjustment below: tab screens
  // mount lazily, so the *first* search result followed in a session mounts
  // this screen with its params already present, and an adjustment that only
  // fires on a change would never run. It would then work on every later tap,
  // which is the worst possible shape for the bug.
  const [state, setState] = useState(() =>
    withLink(
      createRitualState(undefined, undefined, preferences.enableJournal),
      link ?? { date: null, step: null },
    ),
  );

  // So "New Task" opened from this tab defaults its schedule to the viewed day,
  // the same contract Today and Week publish. Following a link to an old
  // journal entry therefore defaults a new task to that day until the user
  // navigates — the Today tab has always behaved this way.
  usePublishViewedDay(state.date);

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

  // Follow the journal preference, which is toggled in another tab while this
  // screen stays mounted. `usePreferences` serves defaults (journal on) until
  // the row loads, so on a cold launch with it disabled this corrects a moment
  // after mount — `withJournalEnabled` keeps the user on the same step by id,
  // which is what makes that correction unremarkable.
  if (state.journalEnabled !== preferences.enableJournal) {
    setState((current) =>
      withJournalEnabled(current, preferences.enableJournal),
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
