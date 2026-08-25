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
 *
 * Relax exhales longer than it inhales, which is the entire technique — it
 * shipped inverted, hence tests asserting the relationships and not the values.
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
 * `20260816210000_add_preferences_breathe.sql`; each pair must move together.
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
}[] = [...BREATHING_TECHNIQUE_OPTIONS, { label: "Shuffle", value: "shuffle" }];

/** The count as the step says it, and as the Settings menu lists it. */
export const describeBreathCount = (count: number): string =>
  count === 1 ? "1 breath" : `${count} breaths`;

/**
 * Every count the step can run, for the Settings picker.
 *
 * Derived from the bounds above rather than spelled out the way
 * `FOCUS_BLOCK_LENGTHS` is: those lengths are an irregular list picked by taste,
 * where this is simply the range, and deriving it means the menu cannot drift
 * from what `resolveBreathCount` clamps to.
 *
 * Values are strings because `PickerField<V extends string>` requires it; the
 * call site reads them back through `Number`, the same round-trip the focus
 * block lengths make. Labels carry the unit so a menu row reads on its own.
 */
export const BREATH_COUNT_OPTIONS: readonly {
  label: string;
  value: string;
}[] = Array.from({ length: MAX_BREATHS - MIN_BREATHS + 1 }, (_, index) => {
  const count = MIN_BREATHS + index;
  return { label: describeBreathCount(count), value: String(count) };
});

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
 * How long each phase word takes to fade in and out, as a share of its own leg.
 *
 * A fraction rather than a fixed duration so the fade stays in proportion on a
 * one-breath run and a ten-breath one.
 */
const WORD_FADE_RATIO = 0.08;

/**
 * How long the step holds *no* word at each end of a leg, as a share of it.
 *
 * The words used to cross-fade: both windows sat on the boundary, so "Exhale"
 * was arriving while "Inhale" was still leaving and the two were briefly legible
 * over one another. This is the beat of nothing that separates them — the word
 * leaves before the turn and the next arrives after it, which is also how the
 * breath itself feels at the top.
 *
 * Both this and the fade are shares of the leg, so a word's whole window is
 * `2 × (gap + fade)` of it — well under the leg however the durations are
 * retuned, which is what keeps every `input` array below monotonic. A
 * non-monotonic one makes `interpolate` return garbage, with no symptom short
 * of a device.
 */
const WORD_GAP_RATIO = 0.06;

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
    const span = end - start;
    const fade = span * WORD_FADE_RATIO;
    const gap = span * WORD_GAP_RATIO;
    const table = words[leg.phase];
    // The whole window sits *inside* the leg, which is what puts a gap either
    // side of every boundary: the word is already gone before the leg ends and
    // the next one has not started yet. It also means no point can fall outside
    // [0, 1], so unlike the crossing version this needs no clamping — a
    // negative input would be a breakpoint the driver never reaches.
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
 * Whether a plan leaves the fill empty, which every technique must.
 *
 * Exported for the test that pins it rather than merely asserted there, so the
 * invariant is stated next to the table it constrains — see
 * `BREATHING_TECHNIQUES`.
 */
export const breathePlanEndsEmpty = (plan: TBreathePlan): boolean =>
  plan.levels[plan.levels.length - 1] === 0;

// Which tone a gain change belongs to (DEX-167). One per phase *position*, so
// the two holds are told apart and each can follow the leg before it.
export type TBreathAudioVoice =
  "inhale" | "inhaleHold" | "exhale" | "exhaleHold";

/**
 * One envelope a voice's gain follows: a shape, when it starts, and how long it
 * takes. Two per sounding leg — the rise across the leg, then the fall over the
 * opening of the next.
 *
 * `values` is normalized 0-1, not a gain — the hook multiplies by its own peak,
 * so nothing about how loud the exercise is leaks in here. Samples are evenly
 * spaced across `durationMs`, which is what `setValueCurveAtTime` expects.
 */
export type TBreathAudioCurve = {
  voice: TBreathAudioVoice;
  /** Milliseconds from the start of the run. */
  atMs: number;
  durationMs: number;
  values: readonly number[];
};

/**
 * How finely a curve is sampled.
 *
 * This costs nothing per point: the whole shape is **one** automation event
 * however many samples describe it, which is the entire reason for using curves
 * over a staircase of ramps. High enough that the slowest leg — eight seconds of
 * Relax's exhale — still gets a breakpoint every ~60ms.
 */
const CURVE_POINTS = 128;

/**
 * The sliver of silence between a leg's rise and its own fall.
 *
 * Not cosmetic. A curve is rejected if anything starts *strictly inside* its
 * window, so a fall beginning exactly where its rise ended is legal — but only
 * if the two times are bit-identical doubles, and they are reached by different
 * arithmetic (`at(start) + leg.ms/1000` against `at(start + leg.ms)`). One ULP
 * of drift the wrong way and the whole run throws instead of sounding. A
 * millisecond is many orders of magnitude clear of that, and the param simply
 * holds its last value across it — the curve had already reached full.
 */
const CURVE_GAP_MS = 1;

// Steepest at the start, flattening into the finish. A curve eased at *both*
// ends has zero slope at zero, which is audible as a delay.
export const easeOut = (t: number): number => Math.sin((Math.PI / 2) * t);

// Flat at both ends: wrong for an attack, right for a fade nobody should hear
// the shape of.
export const easeInOut = (t: number): number => (1 - Math.cos(Math.PI * t)) / 2;

/**
 * The most automation events one `AudioParam` will hold.
 *
 * `react-native-audio-api` bounds *both* of a param's queues at this
 * (`AUDIO_PARAM_MAX_QUEUED_EVENTS`, `core/utils/Constants.h`) and past it
 * `push` returns false and the event is **dropped silently** — no error, no
 * warning, the param simply stops changing and holds its last value. The
 * envelope used to be a staircase of 25 `linearRampToValueAtTime` calls per
 * leg, which at three breaths — the app's default — overran the queue partway
 * through the third leg and lost its release, so the chord never came back down
 * and droned under the rest of the run. That was DEX-187. Two curves per leg
 * puts a ten-breath run at 21 events, and browsers have no such bound anyway.
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
 * Every envelope of one run (DEX-167), scheduled on the audio clock the moment
 * Begin is pressed — so nothing recomputes per leg and nothing drifts.
 *
 * Each leg's tone rises across its own leg and releases over the opening of the
 * next, leaving two chords always crossfading. Entries are in time order **per
 * voice**, which is the ordering `AudioParam` automation actually cares about.
 *
 * **Two events per leg, not twenty-five.** A curve is one event however finely
 * it is sampled, which is what keeps a ten-breath run inside
 * `BREATH_AUDIO_MAX_EVENTS_PER_PARAM`. A leg's rise ends exactly where its fall
 * begins, which the library allows: events strictly inside a curve's window
 * collide with it, events landing on the boundary do not.
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
