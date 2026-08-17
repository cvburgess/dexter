import { Temporal } from "@js-temporal/polyfill";

import {
  breathePlanEndsEmpty,
  BREATHING_TECHNIQUE_ORDER,
  BREATHING_TECHNIQUE_OPTIONS,
  BREATHING_TECHNIQUE_SETTING_OPTIONS,
  BREATHING_TECHNIQUES,
  buildBreathePlan,
  DEFAULT_BREATH_COUNT,
  DEFAULT_BREATHING_TECHNIQUE,
  MAX_BREATHS,
  MIN_BREATHS,
  resolveBreathCount,
  resolveBreathingTechniqueSetting,
  techniqueForDay,
  type TBreathingTechnique,
} from "../breathing";

const isIncreasing = (values: readonly number[]): boolean =>
  values.every((value, index) => index === 0 || value > values[index - 1]);

describe("BREATHING_TECHNIQUES", () => {
  it("matches the durations DEX-164 specifies", () => {
    expect(BREATHING_TECHNIQUES.simple.cycle).toEqual([
      { phase: "inhale", ms: 6000 },
      { phase: "exhale", ms: 6000 },
    ]);
    expect(BREATHING_TECHNIQUES.relax.cycle).toEqual([
      { phase: "inhale", ms: 8000 },
      { phase: "exhale", ms: 6000 },
    ]);
    expect(BREATHING_TECHNIQUES.box.cycle).toEqual([
      { phase: "inhale", ms: 5000 },
      { phase: "hold", ms: 5000 },
      { phase: "exhale", ms: 5000 },
      { phase: "hold", ms: 5000 },
    ]);
  });

  it("offers the three techniques in the step's control and those plus shuffle in settings", () => {
    expect(BREATHING_TECHNIQUE_OPTIONS.map((o) => o.value)).toEqual([
      "simple",
      "relax",
      "box",
    ]);
    expect(BREATHING_TECHNIQUE_SETTING_OPTIONS.map((o) => o.value)).toEqual([
      "simple",
      "relax",
      "box",
      "shuffle",
    ]);
  });
});

describe("resolveBreathCount", () => {
  it("passes through every count the slider can produce", () => {
    for (let count = MIN_BREATHS; count <= MAX_BREATHS; count += 1) {
      expect(resolveBreathCount(count)).toBe(count);
    }
  });

  it("clamps a count outside the range a later build could have stored", () => {
    expect(resolveBreathCount(0)).toBe(MIN_BREATHS);
    expect(resolveBreathCount(-4)).toBe(MIN_BREATHS);
    expect(resolveBreathCount(25)).toBe(MAX_BREATHS);
  });

  it("falls back to the default for a value that is not a whole count", () => {
    expect(resolveBreathCount(3.5)).toBe(DEFAULT_BREATH_COUNT);
    expect(resolveBreathCount(Number.NaN)).toBe(DEFAULT_BREATH_COUNT);
  });
});

describe("resolveBreathingTechniqueSetting", () => {
  it("passes through every value the settings picker offers", () => {
    for (const option of BREATHING_TECHNIQUE_SETTING_OPTIONS) {
      expect(resolveBreathingTechniqueSetting(option.value)).toBe(option.value);
    }
  });

  it("falls back to the default for a technique this build does not know", () => {
    expect(resolveBreathingTechniqueSetting("coherent")).toBe(
      DEFAULT_BREATHING_TECHNIQUE,
    );
    expect(resolveBreathingTechniqueSetting("")).toBe(
      DEFAULT_BREATHING_TECHNIQUE,
    );
  });
});

describe("techniqueForDay", () => {
  const date = Temporal.PlainDate.from("2026-08-16");

  it("returns a named technique unchanged", () => {
    for (const technique of BREATHING_TECHNIQUE_ORDER) {
      expect(techniqueForDay(technique, date)).toBe(technique);
    }
  });

  it("rotates shuffle through every technique on consecutive days", () => {
    const week = Array.from({ length: 7 }, (_, offset) =>
      techniqueForDay("shuffle", date.add({ days: offset })),
    );
    expect(new Set(week)).toEqual(new Set(BREATHING_TECHNIQUE_ORDER));
    // Never the same technique two days running, which is the whole point.
    expect(week.slice(1).every((value, i) => value !== week[i])).toBe(true);
  });

  it("is stable for a given day", () => {
    expect(techniqueForDay("shuffle", date)).toBe(
      techniqueForDay("shuffle", Temporal.PlainDate.from("2026-08-16")),
    );
  });

  it("keeps rotating across a year boundary", () => {
    // `dayOfYear` would stutter here: 2026 has 365 days, and 365 % 3 leaves
    // Dec 31 and Jan 1 on the same technique.
    const newYear = Temporal.PlainDate.from("2027-01-01");
    expect(techniqueForDay("shuffle", newYear)).not.toBe(
      techniqueForDay("shuffle", newYear.subtract({ days: 1 })),
    );
  });

  it("indexes in range for a date before the epoch", () => {
    const old = Temporal.PlainDate.from("1965-03-02");
    expect(BREATHING_TECHNIQUE_ORDER).toContain(
      techniqueForDay("shuffle", old),
    );
  });
});

describe("buildBreathePlan", () => {
  const techniques =
    BREATHING_TECHNIQUE_ORDER as readonly TBreathingTechnique[];

  it("repeats the technique's cycle once per breath", () => {
    const plan = buildBreathePlan("box", 3);
    expect(plan.session).toHaveLength(
      BREATHING_TECHNIQUES.box.cycle.length * 3,
    );
    expect(plan.session.slice(0, 4)).toEqual(BREATHING_TECHNIQUES.box.cycle);
    expect(plan.totalMs).toBe(20000 * 3);
  });

  it("narrows a count the step could not have chosen", () => {
    expect(buildBreathePlan("simple", 99).session).toHaveLength(
      BREATHING_TECHNIQUES.simple.cycle.length * MAX_BREATHS,
    );
  });

  it("fills on the inhale, empties on the exhale, and holds through a hold", () => {
    expect(buildBreathePlan("box", 1).levels).toEqual([1, 1, 0, 0]);
    expect(buildBreathePlan("simple", 2).levels).toEqual([1, 0, 1, 0]);
  });

  it.each(techniques)("leaves the fill empty at the end of %s", (technique) => {
    for (let breaths = MIN_BREATHS; breaths <= MAX_BREATHS; breaths += 1) {
      expect(breathePlanEndsEmpty(buildBreathePlan(technique, breaths))).toBe(
        true,
      );
    }
  });

  it.each(techniques)("builds usable word tables for %s", (technique) => {
    const plan = buildBreathePlan(technique, 4);
    for (const phase of ["inhale", "hold", "exhale"] as const) {
      const { input, output } = plan.words[phase];
      // `interpolate` needs at least two breakpoints and reads a non-monotonic
      // input as garbage — neither has any symptom short of a device.
      expect(input.length).toBeGreaterThanOrEqual(2);
      expect(input).toHaveLength(output.length);
      expect(isIncreasing(input)).toBe(true);
      expect(input[0]).toBeGreaterThanOrEqual(0);
      expect(input[input.length - 1]).toBeLessThanOrEqual(1);
      expect(output.every((value) => value === 0 || value === 1)).toBe(true);
    }
  });

  it("gives an unused phase a flat table rather than an empty one", () => {
    // Neither Simple nor Relax has a hold, and the step renders all three words
    // unconditionally.
    expect(buildBreathePlan("simple", 3).words.hold).toEqual({
      input: [0, 1],
      output: [0, 0],
    });
    expect(buildBreathePlan("box", 3).words.hold.output).toContain(1);
  });

  it("pulses each phase's word once per leg that uses it", () => {
    const plan = buildBreathePlan("box", 2);
    // Four points per pulse; box holds twice per breath, inhales once.
    expect(plan.words.hold.input).toHaveLength(4 * 4);
    expect(plan.words.inhale.input).toHaveLength(2 * 4);
  });

  // The words used to cross-fade on the boundary, so two were briefly legible
  // at once. Each one's window now sits inside its own leg, which leaves a beat
  // of nothing between them.
  it.each(techniques)(
    "leaves a gap between one word and the next for %s",
    (technique) => {
      const plan = buildBreathePlan(technique, 3);
      // Every point at which some word is mid-fade or fully on, in time order:
      // each leg contributes the window [fade-in start, fade-out end].
      const windows = (["inhale", "hold", "exhale"] as const)
        .flatMap((phase) => {
          const { input, output } = plan.words[phase];
          // The flat table an unused phase gets is not a window.
          if (!output.includes(1)) return [];
          const pulses = [];
          for (let i = 0; i < input.length; i += 4) {
            pulses.push({ from: input[i], to: input[i + 3] });
          }
          return pulses;
        })
        .sort((a, b) => a.from - b.from);

      expect(windows).toHaveLength(plan.session.length);
      for (let i = 1; i < windows.length; i += 1) {
        expect(windows[i].from).toBeGreaterThan(windows[i - 1].to);
      }
    },
  );

  // The run opens and closes on the neutral background rather than mid-word —
  // `BreatheFill` fades the whole layer in over the top of this anyway.
  it("keeps the first and last word inside the run", () => {
    const plan = buildBreathePlan("relax", 2);
    expect(plan.words.inhale.input[0]).toBeGreaterThan(0);
    const exhale = plan.words.exhale.input;
    expect(exhale[exhale.length - 1]).toBeLessThan(1);
  });
});
