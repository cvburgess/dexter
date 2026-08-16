import { Temporal } from "@js-temporal/polyfill";

/**
 * The Breathe ritual step's model (DEX-164): the techniques on offer, and the
 * whole timeline of one run of one of them.
 *
 * React-free and import-free besides `Temporal`, the same split `ritualSteps`
 * takes and for the same reason — but here there is a second, sharper one.
 * Everything downstream of `buildBreathePlan` is a worklet, and
 * `docs/testing.md` is blunt that no test can see across that boundary: the
 * reanimated mock renders it opaque, so a wrong number in an interpolation
 * table has no symptom until it is on a device. Keeping the entire timeline as
 * plain arrays computed here means the part that can be wrong is the part that
 * is tested, and the worklet is left with nothing to decide.
 */

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
 * What the *preference* can hold, which is one more thing than the step can
 * run: `"shuffle"` picks a technique per day rather than naming one. Offered in
 * Settings only — the step's own control lists the three real techniques, since
 * choosing "whichever" for a session you are about to start is not a choice.
 */
export type TBreathingTechniqueSetting = TBreathingTechnique | "shuffle";

/** The word held in the center of the step during each phase. */
export const BREATH_PHASE_LABELS: Record<TBreathPhase, string> = {
  inhale: "Inhale",
  hold: "Hold",
  exhale: "Exhale",
};

/**
 * The techniques, each as the legs of a **single breath** — `buildBreathePlan`
 * repeats the cycle rather than storing a whole run.
 *
 * **Every cycle ends at an empty fill**, on an exhale or on the hold after one.
 * The step leans on that: a run simply stops when its last leg does, with no
 * settling animation and no filled-page end state to get the controls back off
 * of. A fourth technique ending on an inhale would break that quietly, which is
 * why `breathePlanEndsEmpty` exists to assert it.
 *
 * Durations are the ones in DEX-164 and are deliberately whole seconds: the
 * numbers are also what the step *says* it is doing, and "inhale for six" is a
 * count the breather can follow when they look away from the screen.
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
      { phase: "inhale", ms: 8000 },
      { phase: "exhale", ms: 6000 },
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
 * The techniques in rotation order, which is also the order both controls list
 * them in — shortest breath first, so the row reads as increasing effort.
 *
 * Spelled out as values rather than taken from `Object.keys` above, so it is a
 * `readonly` tuple the compiler can index and `techniqueForDay` cannot return
 * `undefined` from.
 */
export const BREATHING_TECHNIQUE_ORDER = ["simple", "relax", "box"] as const;

/** How many breaths a run can be — the bounds of the step's slider. */
export const MIN_BREATHS = 1;
export const MAX_BREATHS = 10;

/**
 * The count and technique a user who has expressed no preference starts from.
 * Both match the column defaults in
 * `20260816_add_preferences_breathe.sql`; each pair must move together.
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
 * The same three plus Shuffle, for the Settings picker. Values are strings
 * because `PickerField<V extends string>` requires it — which these already
 * are, so unlike the focus-block lengths nothing has to round-trip through
 * `Number`.
 */
export const BREATHING_TECHNIQUE_SETTING_OPTIONS: readonly {
  label: string;
  value: TBreathingTechniqueSetting;
}[] = [
  ...BREATHING_TECHNIQUE_OPTIONS,
  { label: "Shuffle", value: "shuffle" },
];

/**
 * A stored breath count narrowed to one the step can run.
 *
 * The column carries no CHECK constraint, for the reason
 * `focus_block_minutes` carries none: the range is app-owned and expected to
 * move with taste, so an older build has to be able to read a count it doesn't
 * offer. Out of range clamps rather than falling back to the default — a 12
 * saved by a later build means "as many as you'll give me", and 10 honours that
 * where 3 would silently contradict it. A non-integer is not a near miss of
 * anything, so it takes the default.
 */
export const resolveBreathCount = (count: number): number => {
  if (!Number.isInteger(count)) return DEFAULT_BREATH_COUNT;
  return Math.min(MAX_BREATHS, Math.max(MIN_BREATHS, count));
};

/**
 * A stored technique narrowed to one this build knows.
 *
 * Unlike the count there is nothing to clamp toward — an unrecognized name is
 * a technique a later build added, and guessing which of ours it resembles
 * would be worse than starting from the default. Mirrors
 * `resolveFocusBlockMinutes` and `resolveAlarmSound`.
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
 * The technique a given day runs — the identity for a named setting, and the
 * rotation for `"shuffle"`.
 *
 * Derived from the date rather than stored, so nothing has to be written when
 * the day turns and two devices opening the same evening's ritual agree. The
 * remainder is taken off days since the epoch rather than `dayOfYear`, which
 * would stutter at every new year (365 % 3 lands back on the same technique two
 * days running).
 */
export const techniqueForDay = (
  setting: TBreathingTechniqueSetting,
  date: Temporal.PlainDate,
): TBreathingTechnique => {
  if (setting !== "shuffle") return setting;
  const days = EPOCH.until(date, { largestUnit: "day" }).days;
  const count = BREATHING_TECHNIQUE_ORDER.length;
  // `((n % k) + k) % k` rather than `n % k`: JavaScript's remainder keeps the
  // sign of the dividend, so a date before 1970 would index the tuple with a
  // negative number and hand back `undefined`.
  return BREATHING_TECHNIQUE_ORDER[((days % count) + count) % count];
};

/** An `interpolate` table — input breakpoints and the output at each. */
export type TBreatheInterpolation = {
  input: readonly number[];
  output: readonly number[];
};

/**
 * How long each phase word takes to cross-fade into the next, as a share of
 * the leg on either side of the boundary.
 *
 * A fraction rather than a fixed duration so the fade stays in proportion on a
 * one-breath run and a ten-breath one, and so the windows below can never
 * overlap however the technique durations are retuned — which is what would
 * make the interpolation table non-monotonic and `interpolate` return garbage.
 */
const WORD_FADE_RATIO = 0.08;

/** Everything the step's animation needs, and nothing it has to work out. */
export type TBreathePlan = {
  /** Every leg of the run, in order — the whole cycle repeated per breath. */
  session: readonly TBreathLeg[];
  totalMs: number;
  /**
   * The fill level each leg **ends** at, 0 (empty) to 1 (full), index-aligned
   * with `session`. The step turns this straight into a `withSequence` of one
   * timing per leg; a hold's entry repeats the level before it, which is what
   * makes a hold a timing to the value it already holds and so costs the step
   * no branch of its own.
   */
  levels: readonly number[];
  /**
   * One opacity table per phase, over the run's normalized progress. A phase a
   * technique never uses (`hold`, outside Box) gets a flat zero rather than an
   * empty table — `interpolate` needs two points, and a step that rendered its
   * three words conditionally would need to know which, which is exactly the
   * decision this module exists to take away from it.
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
 * The whole timeline of one run.
 *
 * `breaths` is narrowed here rather than at the call site so the step cannot
 * build a plan for a count it could not have chosen.
 */
export const buildBreathePlan = (
  technique: TBreathingTechnique,
  breaths: number,
): TBreathePlan => {
  const { cycle } = BREATHING_TECHNIQUES[technique];
  const session: TBreathLeg[] = [];
  for (let breath = 0; breath < resolveBreathCount(breaths); breath += 1) {
    session.push(...cycle);
  }

  const totalMs = session.reduce((sum, leg) => sum + leg.ms, 0);

  const levels: number[] = [];
  for (const leg of session) {
    levels.push(levelAfter(leg.phase, levels[levels.length - 1] ?? 0));
  }

  // Walk the legs once, building all three tables together: each leg
  // contributes a 0→1→0 pulse to its own phase's table, and nothing to the
  // other two. Points are emitted in time order by construction, which is what
  // keeps every `input` array monotonic without a sort.
  const words: Record<TBreathPhase, { input: number[]; output: number[] }> = {
    inhale: { input: [], output: [] },
    hold: { input: [], output: [] },
    exhale: { input: [], output: [] },
  };

  let elapsed = 0;
  for (const leg of session) {
    const start = elapsed / totalMs;
    const end = (elapsed + leg.ms) / totalMs;
    const fade = ((end - start) * WORD_FADE_RATIO) / 2;
    const table = words[leg.phase];
    // Clamped at the ends so the first word fades up from the run's start
    // rather than from before it, and the last fades out to its end. Without
    // the clamp the table would open on a negative input, which `interpolate`
    // reads as a breakpoint the driver never reaches.
    table.input.push(
      Math.max(0, start - fade),
      start + fade,
      end - fade,
      Math.min(1, end + fade),
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
 * Whether a plan leaves the fill empty, which every technique must.
 *
 * Exported for the test that pins it rather than merely asserted there, so the
 * invariant is stated next to the table it constrains — see
 * `BREATHING_TECHNIQUES`.
 */
export const breathePlanEndsEmpty = (plan: TBreathePlan): boolean =>
  plan.levels[plan.levels.length - 1] === 0;
