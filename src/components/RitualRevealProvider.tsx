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
  /** Called by a driver once the step's content is on screen. Only valid while
   * `seen` is false — calling it after a `true` would un-mark the step. */
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
 * arrival already played (DEX-199). Lives one visit — SwipeablePage keys it. */
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

  // Our own write, read back, would flip `seen` mid-visit — cutting the reveal
  // short and fading the horoscope track out (its `enabled` is a focus dep).
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
