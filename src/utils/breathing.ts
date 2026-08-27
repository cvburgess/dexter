import { Temporal } from "@js-temporal/polyfill";

// The Breathe step's model (DEX-164). Everything downstream is a worklet
// no test can see across, so the whole timeline is plain arrays computed here.

/** What the breather is doing during one leg of a breath. */
export type TBreathPhase = "inhale" | "hold" | "exhale";

/** One leg of a breath: a phase held for a duration. */
export type TBreathLeg = {
  phase: TBreathPhase;
  ms: number;
};

/** A breathing pattern the step can run. */
export type TBreathingTechnique = "simple" | "relax" | "box";

/**
 * One more than the step itself can run: "shuffle" picks per day. Settings
 * only — choosing "whichever" for a session about to start isn't a choice.
 */
export type TBreathingTechniqueSetting = TBreathingTechnique | "shuffle";

/** The word held in the center of the step during each phase. */
export const BREATH_PHASE_LABELS: Record<TBreathPhase, string> = {
  inhale: "Inhale",
  hold: "Hold",
  exhale: "Exhale",
};

/**
 * Legs of one breath — buildBreathePlan repeats the cycle, which must always
 * end empty (breathePlanEndsEmpty pins it; Relax shipped inverted once).
 */
export const BREATHING_TECHNIQUES: Record<
  TBreathingTechnique,
  { label: string; cycle: readonly TBreathLeg[] }
> = {
  simple: {
    label: "Simple",
    cycle: [
      { phase: "inhale", ms: 6000 },
      { phase: "exhale", ms: 6000 },
    ],
  },
  relax: {
    label: "Relax",
    cycle: [
      { phase: "inhale", ms: 6000 },
      { phase: "exhale", ms: 8000 },
    ],
  },
  box: {
    label: "Box",
    cycle: [
      { phase: "inhale", ms: 5000 },
      { phase: "hold", ms: 5000 },
      { phase: "exhale", ms: 5000 },
      { phase: "hold", ms: 5000 },
    ],
  },
};

/**
 * Rotation and control-list order, shortest first. Spelled out rather than
 * Object.keys so techniqueForDay indexes a tuple and can't return undefined.
 */
export const BREATHING_TECHNIQUE_ORDER = ["simple", "relax", "box"] as const;

/** How many breaths a run can be — the bounds of the step's slider. */
export const MIN_BREATHS = 1;
export const MAX_BREATHS = 10;

/**
 * Defaults for a user with no preference — match the column defaults in
 * `20260816210000_add_preferences_breathe.sql`; keep the two in step.
 */
export const DEFAULT_BREATH_COUNT = 3;
export const DEFAULT_BREATHING_TECHNIQUE: TBreathingTechniqueSetting =
  "shuffle";

/** The three real techniques, for the step's segmented control. */
export const BREATHING_TECHNIQUE_OPTIONS: readonly {
  label: string;
  value: TBreathingTechnique;
}[] = BREATHING_TECHNIQUE_ORDER.map((value) => ({
  label: BREATHING_TECHNIQUES[value].label,
  value,
}));

/**
 * The three techniques plus Shuffle. Values are strings for PickerField —
 * unlike focus-block lengths, nothing round-trips through Number.
 */
export const BREATHING_TECHNIQUE_SETTING_OPTIONS: readonly {
  label: string;
  value: TBreathingTechniqueSetting;
}[] = [...BREATHING_TECHNIQUE_OPTIONS, { label: "Shuffle", value: "shuffle" }];

/** The count as the step says it, and as the Settings menu lists it. */
export const describeBreathCount = (count: number): string =>
  count === 1 ? "1 breath" : `${count} breaths`;

/**
 * Every count the step can run. Derived from the bounds, not spelled out
 * like FOCUS_BLOCK_LENGTHS, so the menu can't drift from resolveBreathCount.
 */
export const BREATH_COUNT_OPTIONS: readonly {
  label: string;
  value: string;
}[] = Array.from({ length: MAX_BREATHS - MIN_BREATHS + 1 }, (_, index) => {
  const count = MIN_BREATHS + index;
  return { label: describeBreathCount(count), value: String(count) };
});

/**
 * No CHECK constraint — app-owned range, like focus_block_minutes. Clamps
 * out-of-range instead of defaulting, honouring a later build's larger count.
 */
export const resolveBreathCount = (count: number): number => {
  if (!Number.isInteger(count)) return DEFAULT_BREATH_COUNT;
  return Math.min(MAX_BREATHS, Math.max(MIN_BREATHS, count));
};

/**
 * Unlike the count, nothing to clamp toward — an unrecognized name is a
 * later build's technique; guessing which of ours it resembles is worse.
 */
export const resolveBreathingTechniqueSetting = (
  value: string,
): TBreathingTechniqueSetting =>
  value === "shuffle" ||
  BREATHING_TECHNIQUE_ORDER.some((technique) => technique === value)
    ? (value as TBreathingTechniqueSetting)
    : DEFAULT_BREATHING_TECHNIQUE;

const EPOCH = Temporal.PlainDate.from("1970-01-01");

/**
 * Derived from the date, not stored, so two devices agree at the day turn.
 * Uses days since epoch, not dayOfYear — 365 % 3 stutters at a year boundary.
 */
export const techniqueForDay = (
  setting: TBreathingTechniqueSetting,
  date: Temporal.PlainDate,
): TBreathingTechnique => {
  if (setting !== "shuffle") return setting;
  const days = EPOCH.until(date, { largestUnit: "day" }).days;
  const count = BREATHING_TECHNIQUE_ORDER.length;
  // `((n%k)+k)%k`, not `n%k`: JS remainder keeps the dividend's sign, so a
  // date before 1970 would index with a negative number and return undefined.
  return BREATHING_TECHNIQUE_ORDER[((days % count) + count) % count];
};

/** An `interpolate` table — input breakpoints and the output at each. */
export type TBreatheInterpolation = {
  input: readonly number[];
  output: readonly number[];
};

/**
 * Fade duration for each phase word, as a share of its own leg — proportion
 * stays the same on a one-breath run and a ten-breath one.
 */
const WORD_FADE_RATIO = 0.08;

/**
 * Silence at each leg's ends — words used to cross-fade at the boundary.
 * Must keep 2×(gap+fade) under the leg or `input` goes non-monotonic.
 */
const WORD_GAP_RATIO = 0.06;

/** Everything the step's animation needs, and nothing it has to work out. */
export type TBreathePlan = {
  /** Every leg of the run, in order — the whole cycle repeated per breath. */
  session: readonly TBreathLeg[];
  totalMs: number;
  /**
   * Fill level each leg ends at, 0–1, index-aligned with `session`. A hold
   * repeats the prior level, so the step needs no branch for it.
   */
  levels: readonly number[];
  /**
   * One opacity table per phase. An unused phase (hold, outside Box) gets a
   * flat zero, not empty — `interpolate` needs two points either way.
   */
  words: Record<TBreathPhase, TBreatheInterpolation>;
};

/** The level a leg leaves the fill at, given where the leg before it left it. */
const levelAfter = (phase: TBreathPhase, previous: number): number => {
  if (phase === "inhale") return 1;
  if (phase === "exhale") return 0;
  return previous;
};

/**
 * The whole timeline of one run. `breaths` is narrowed here, not at the call
 * site, so the step can't build a plan for a count it couldn't have chosen.
 */
export const buildBreathePlan = (
  technique: TBreathingTechnique,
  breaths: number,
): TBreathePlan => {
  const { cycle } = BREATHING_TECHNIQUES[technique];
  const count = resolveBreathCount(breaths);
  const session: TBreathLeg[] = [];
  for (let breath = 0; breath < count; breath += 1) {
    session.push(...cycle);
  }

  const totalMs = session.reduce((sum, leg) => sum + leg.ms, 0);

  const levels: number[] = [];
  for (const leg of session) {
    levels.push(levelAfter(leg.phase, levels[levels.length - 1] ?? 0));
  }

  // Walk the legs once: each contributes a 0→1→0 pulse to its own phase's
  // table only. Emitted in time order, so `input` stays monotonic unsorted.
  const words: Record<TBreathPhase, { input: number[]; output: number[] }> = {
    inhale: { input: [], output: [] },
    hold: { input: [], output: [] },
    exhale: { input: [], output: [] },
  };

  let elapsed = 0;
  for (const leg of session) {
    const start = elapsed / totalMs;
    const end = (elapsed + leg.ms) / totalMs;
    const span = end - start;
    const fade = span * WORD_FADE_RATIO;
    const gap = span * WORD_GAP_RATIO;
    const table = words[leg.phase];
    // Window sits inside the leg (gap on both sides of the boundary), so
    // every point stays in [0,1] — unlike the crossing version, no clamping.
    table.input.push(
      start + gap,
      start + gap + fade,
      end - gap - fade,
      end - gap,
    );
    table.output.push(0, 1, 1, 0);
    elapsed += leg.ms;
  }

  return {
    session,
    totalMs,
    levels,
    words: {
      inhale: flatIfEmpty(words.inhale),
      hold: flatIfEmpty(words.hold),
      exhale: flatIfEmpty(words.exhale),
    },
  };
};

const flatIfEmpty = (table: {
  input: number[];
  output: number[];
}): TBreatheInterpolation =>
  table.input.length === 0 ? { input: [0, 1], output: [0, 0] } : table;

/**
 * Whether a plan ends empty, which every technique must. Exported so the
 * test pinning it states the invariant next to BREATHING_TECHNIQUES.
 */
export const breathePlanEndsEmpty = (plan: TBreathePlan): boolean =>
  plan.levels[plan.levels.length - 1] === 0;

// Which tone a gain change belongs to (DEX-167). One per phase *position*, so
// the two holds are told apart and each can follow the leg before it.
export type TBreathAudioVoice =
  "inhale" | "inhaleHold" | "exhale" | "exhaleHold";

/**
 * One gain envelope: shape, start, duration. Two per leg — rise across it,
 * fall over the next. `values` is normalized 0-1; the hook scales by peak.
 */
export type TBreathAudioCurve = {
  voice: TBreathAudioVoice;
  /** Milliseconds from the start of the run. */
  atMs: number;
  durationMs: number;
  values: readonly number[];
};

/**
 * Curve sample density — free per point since the whole shape is one
 * automation event; high enough for ~60ms breakpoints on the slowest leg.
 */
const CURVE_POINTS = 128;

/**
 * Silence between a leg's rise and fall — not cosmetic. A same-instant
 * boundary risks ULP drift between arithmetic paths; 1ms is safely clear.
 */
const CURVE_GAP_MS = 1;

// Steepest at the start, flattening into the finish. A curve eased at *both*
// ends has zero slope at zero, which is audible as a delay.
export const easeOut = (t: number): number => Math.sin((Math.PI / 2) * t);

// Flat at both ends: wrong for an attack, right for a fade nobody should hear
// the shape of.
export const easeInOut = (t: number): number => (1 - Math.cos(Math.PI * t)) / 2;

/**
 * react-native-audio-api silently drops events past this bound — 25
 * ramps/leg overran it and lost the release, droning forever (DEX-187).
 */
export const BREATH_AUDIO_MAX_EVENTS_PER_PARAM = 64;

// Reaching full only as a leg ended made the clearest moment of every phase the
// moment it was over.
const ATTACK_RATIO = 2 / 3;

// How much of the *next* leg a finished tone releases over. Too high and the
// phase you left is still sounding well into the one you are in.
const RELEASE_RATIO = 1 / 3;

/** The tone a leg sounds — a hold takes its identity from the leg before it. */
const voiceFor = (
  plan: TBreathePlan,
  index: number,
): TBreathAudioVoice | null => {
  const phase = plan.session[index]?.phase;
  if (phase === "inhale") return "inhale";
  if (phase === "exhale") return "exhale";
  if (phase !== "hold") return null;
  // `levels` is already the answer: full means the inhale just ended.
  return (plan.levels[index - 1] ?? 0) === 1 ? "inhaleHold" : "exhaleHold";
};

/** A shape sampled evenly from 0 to 1 inclusive, ready for a curve. */
const sample = (shape: (t: number) => number): number[] =>
  Array.from({ length: CURVE_POINTS }, (_, index) =>
    shape(index / (CURVE_POINTS - 1)),
  );

// Full once the attack is done, and held there for the rest of the leg.
const ATTACK = sample((t) =>
  t >= ATTACK_RATIO ? 1 : easeOut(t / ATTACK_RATIO),
);
const RELEASE = sample((t) => 1 - easeOut(t));

/**
 * Every envelope of one run (DEX-167), scheduled at Begin so nothing drifts.
 * Two events per leg, not twenty-five, stays inside the param's event bound.
 */
export const buildBreathAudioSchedule = (
  plan: TBreathePlan,
): readonly TBreathAudioCurve[] => {
  const schedule: TBreathAudioCurve[] = [];
  let start = 0;

  plan.session.forEach((leg, index) => {
    const end = start + leg.ms;
    const voice = voiceFor(plan, index);
    if (!voice) {
      start = end;
      return;
    }
    // The last leg has nothing after it, so it releases over a share of itself
    // and the exit fade catches the rest.
    const fallMs = (plan.session[index + 1]?.ms ?? leg.ms) * RELEASE_RATIO;

    schedule.push({
      voice,
      atMs: start,
      durationMs: leg.ms - CURVE_GAP_MS,
      values: ATTACK,
    });
    schedule.push({ voice, atMs: end, durationMs: fallMs, values: RELEASE });

    start = end;
  });

  return schedule;
};
