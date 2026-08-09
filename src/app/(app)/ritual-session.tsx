import { Temporal } from "@js-temporal/polyfill";
import { Href, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ModalScreen } from "@/components/ModalScreen";
import { SmallScreenRitual } from "@/components/SmallScreenRitual";
import { useDismissModal } from "@/hooks/useDismissModal";
import {
  advanceStep,
  createRitualState,
  goToStep,
  parseRitualMode,
  withDate,
} from "@/utils/ritualSteps";
import { parseDayDate } from "@/utils/todayRoute";

/** Where this modal returns to when it can't just pop — one value, because a
 * cold deep link and a ✕ have to land in the same place. */
const HOME: Href = "/ritual";

/**
 * The ritual run as a modal, opened by the play button in the large-screen
 * toolbar (DEX-127).
 *
 * A guided one-step-at-a-time flow reads better in a narrow column than spread
 * across a desktop window, so this presents the *phone* experience verbatim
 * rather than a second, wider one — `SmallScreenRitual` is shared, and the only
 * difference is the leading header control (✕ here, the AM/PM switch on the
 * tab, since the mode is chosen in the toolbar that opened this).
 *
 * It holds its own copy of the ritual state, seeded from the route. The tab's
 * copy is separate and stays where it was — acceptable while the large-screen
 * body is empty, and the moment it isn't, the fix is a module-scoped store like
 * `hooks/useViewedDay.tsx`.
 *
 * Declared here rather than inside the tab so it floats over the nav rail, and
 * with `headerShown: false` on **both** platforms (see `app/(app)/_layout.tsx`)
 * so the header below can be a real `DayNav` — see that declaration for why a
 * native header can't hold one.
 */
export default function RitualSessionScreen() {
  const dismiss = useDismissModal(HOME);
  const insets = useSafeAreaInsets();
  // The inset the app publishes has the native tab bar's height baked into
  // `bottom`, because the tab screens deliberately render under it. A form
  // sheet floats above that bar and ends well short of the screen's edge, so
  // for anything inside it that figure is simply wrong — `EmptyScreen`, which
  // every ritual step renders, would reserve a bar's worth of space that isn't
  // there and sit visibly high. Zero it for the subtree rather than teaching
  // each child about a host it can't see (the same correction
  // `TaskDrawerSheet` makes for the opposite reason). Memoized so a step
  // change doesn't hand the subtree a fresh context value.
  const contentInsets = useMemo(() => ({ ...insets, bottom: 0 }), [insets]);
  // A hand-edited or stale URL is real here (the route is linkable on web), so
  // both params fall back rather than throwing: `parseDayDate` already rejects
  // an impossible date like `2026-02-30`, and an unrecognized mode reads as
  // absent and picks itself off the clock.
  const params = useLocalSearchParams<{
    date?: string | string[];
    mode?: string | string[];
  }>();
  const [state, setState] = useState(() =>
    createRitualState(
      parseDayDate(params.date) ?? undefined,
      parseRitualMode(params.mode) ?? undefined,
    ),
  );

  const changeDate = (date: Temporal.PlainDate) =>
    setState((current) => withDate(current, date));
  const selectStep = (index: number) =>
    setState((current) => goToStep(current, index));
  const swipe = (direction: 1 | -1) =>
    setState((current) => advanceStep(current, direction));

  return (
    <ModalScreen>
      <SafeAreaInsetsContext.Provider value={contentInsets}>
        <SmallScreenRitual
          onChangeDate={changeDate}
          onClose={dismiss}
          onSelectStep={selectStep}
          onSwipe={swipe}
          state={state}
        />
      </SafeAreaInsetsContext.Provider>
    </ModalScreen>
  );
}
