import { Temporal } from "@js-temporal/polyfill";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { useSeenRitualSteps } from "@/hooks/useSeenRitualSteps";
import { useToday } from "@/hooks/useToday";
import { stepVisitKey, TRitualMode, TRitualStepId } from "@/utils/ritualSteps";

export type TStepReveal = {
  /** `null` while the device read is in flight — drivers wait rather than
   * animating against an answer that may still say "already seen". */
  seen: boolean | null;
  /** Called by a driver the moment it starts a real animation. */
  markRevealed: () => void;
};

const noop = () => {};

/** Outside a provider a step animates exactly as it did before DEX-199. */
const NOT_GATED: TStepReveal = { seen: false, markRevealed: noop };

/** Any day but today: the arrival is a flourish for the day you are living,
 * not for a record you are reviewing. Never `null`, so nothing waits. */
const ALWAYS_SEEN: TStepReveal = { seen: true, markRevealed: noop };

const RitualRevealContext = createContext<TStepReveal | null>(null);

export function useStepReveal(): TStepReveal {
  return useContext(RitualRevealContext) ?? NOT_GATED;
}

type TRitualRevealProviderProps = {
  date: Temporal.PlainDate;
  mode: TRitualMode;
  stepId: TRitualStepId;
  children: ReactNode;
};

/** Tells every animation and audio driver in one ritual step whether its
 * arrival has already played (DEX-199). Mounted inside `SwipeablePage`'s
 * keyed subtree, so its lifetime is exactly one visit to one step. */
export function RitualRevealProvider({
  date,
  mode,
  stepId,
  children,
}: TRitualRevealProviderProps) {
  const today = useToday();
  const isToday = date.equals(today);
  const day = date.toString();
  const key = stepVisitKey(day, mode, stepId);

  const [stored, { markSeen, isLoading }] = useSeenRitualSteps(isToday);

  // Once a driver here has marked, the stored `true` is our own write — read it
  // back and `seen` would flip mid-visit, cutting the reveal short and, because
  // `useHoroscopeAudio`'s `enabled` is a `useFocusEffect` dependency, fading the
  // track out seconds after it started. A fresh mount resets this, which is
  // exactly the next visit.
  const [markedHere, setMarkedHere] = useState(false);
  const seen = isLoading
    ? null
    : !markedHere && stored.date === day && stored.keys.includes(key);

  const markRevealed = useCallback(() => {
    setMarkedHere(true);
    void markSeen(day, key);
  }, [day, key, markSeen, setMarkedHere]);

  const gated = useMemo(() => ({ seen, markRevealed }), [markRevealed, seen]);

  return (
    <RitualRevealContext.Provider value={isToday ? gated : ALWAYS_SEEN}>
      {children}
    </RitualRevealContext.Provider>
  );
}
