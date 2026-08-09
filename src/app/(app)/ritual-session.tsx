import { Temporal } from "@js-temporal/polyfill";
import { Href, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { ModalScreen } from "@/components/ModalScreen";
import { SmallScreenRitual } from "@/components/SmallScreenRitual";
import { useDismissModal } from "@/hooks/useDismissModal";
import {
  advanceStep,
  createRitualState,
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
  const next = () => setState((current) => advanceStep(current, 1));
  const swipe = (direction: 1 | -1) =>
    setState((current) => advanceStep(current, direction));

  return (
    <ModalScreen>
      <SmallScreenRitual
        onChangeDate={changeDate}
        onClose={dismiss}
        onNext={next}
        onSwipe={swipe}
        state={state}
      />
    </ModalScreen>
  );
}
