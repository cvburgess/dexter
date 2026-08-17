import { Temporal } from "@js-temporal/polyfill";

import {
  breathePlanEndsEmpty,
  buildBreathAudioSchedule,
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
  type TBreathAudioRamp,
  type TBreathAudioVoice,
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

describe("buildBreathAudioSchedule", () => {
  const voice = (
    schedule: readonly TBreathAudioRamp[],
    which: TBreathAudioVoice,
  ) => schedule.filter((step) => step.voice === which);

  // Per voice, not across the whole list: an exhale leg lays the breath's curve
  // and then the accent's over the same span, and `AudioParam` automation is
  // scheduled independently on each.
  it.each(BREATHING_TECHNIQUE_ORDER)(
    "keeps every voice in time order and inside the run (%s)",
    (technique) => {
      const plan = buildBreathePlan(technique, 3);
      const schedule = buildBreathAudioSchedule(plan);

      expect(schedule.length).toBeGreaterThan(0);
      for (const which of ["breath", "hold", "exhale"] as const) {
        const steps = voice(schedule, which);
        for (let i = 1; i < steps.length; i += 1) {
          expect(steps[i].atMs).toBeGreaterThanOrEqual(steps[i - 1].atMs);
        }
      }

      expect(Math.min(...schedule.map((step) => step.atMs))).toBe(0);
      expect(Math.max(...schedule.map((step) => step.atMs))).toBe(plan.totalMs);
    },
  );

  // The whole point of the `set`/`ramp` split: a ramp glides from the previous
  // scheduled event, so one without an anchor at its own leg's start would
  // slide across whatever came before it — audibly, across a hold.
  it.each(BREATHING_TECHNIQUE_ORDER)(
    "anchors every ramp with a set at the same instant or earlier (%s)",
    (technique) => {
      const schedule = buildBreathAudioSchedule(buildBreathePlan(technique, 2));

      for (const which of ["breath", "hold"] as const) {
        const steps = voice(schedule, which);
        steps.forEach((step, index) => {
          if (step.kind !== "ramp") return;
          const anchored = steps
            .slice(0, index)
            .some((earlier) => earlier.kind === "set");
          expect(anchored).toBe(true);
        });
      }
    },
  );

  // The tone's loudness *is* how full the screen is, so a drift between these
  // two would be a sound that no longer matches the animation. Only the leg
  // boundaries are pinned — what the curve does between them is the hook's
  // business, and `useBreathAudio.test.ts` covers its shape.
  it("tracks the fill level on the breath voice", () => {
    const plan = buildBreathePlan("simple", 2);
    const breath = voice(buildBreathAudioSchedule(plan), "breath");

    expect(breath.filter((step) => step.kind === "set")).toEqual([
      { voice: "breath", atMs: 0, value: 0, kind: "set" },
      { voice: "breath", atMs: 6000, value: 1, kind: "set" },
      { voice: "breath", atMs: 12000, value: 0, kind: "set" },
      { voice: "breath", atMs: 18000, value: 1, kind: "set" },
    ]);

    // Simple's legs are 6s, so only the last segment of each lands on a
    // multiple of one — the eased points in between never do.
    expect(
      breath.filter((step) => step.kind === "ramp" && step.atMs % 6000 === 0),
    ).toEqual([
      { voice: "breath", atMs: 6000, value: 1, kind: "ramp" },
      { voice: "breath", atMs: 12000, value: 0, kind: "ramp" },
      { voice: "breath", atMs: 18000, value: 1, kind: "ramp" },
      { voice: "breath", atMs: 24000, value: 0, kind: "ramp" },
    ]);
  });

  // Straight lines are what made the first attempt sound mechanical.
  it("eases each leg rather than travelling it at a constant rate", () => {
    const breath = voice(
      buildBreathAudioSchedule(buildBreathePlan("simple", 1)),
      "breath",
    );
    const rise = breath.filter(
      (step) => step.kind === "ramp" && step.atMs <= 6000,
    );

    // Monotonic and symmetric about the midpoint, but nowhere near a line: a
    // quarter of the way in it has covered well under a quarter of the ground.
    expect(rise.every((s, i) => i === 0 || s.value > rise[i - 1].value)).toBe(
      true,
    );
    expect(rise.find((s) => s.atMs === 3000)?.value).toBeCloseTo(0.5, 10);
    expect(rise.find((s) => s.atMs === 1500)?.value).toBeLessThan(0.25);
  });

  it.each(BREATHING_TECHNIQUE_ORDER)(
    "leaves the breath voice silent at the end (%s)",
    (technique) => {
      const breath = voice(
        buildBreathAudioSchedule(buildBreathePlan(technique, 3)),
        "breath",
      );
      expect(breath[breath.length - 1].value).toBe(0);
    },
  );

  // Simple and Relax have no hold legs, so the second voice never sounds for
  // them — it is not merely quiet, it is absent from the schedule entirely.
  it("only sounds the hold voice for a technique that holds", () => {
    for (const technique of ["simple", "relax"] as const) {
      const plan = buildBreathePlan(technique, 3);
      expect(voice(buildBreathAudioSchedule(plan), "hold")).toEqual([]);
    }

    // Two holds per breath, each opening on an anchor.
    const box = buildBreathAudioSchedule(buildBreathePlan("box", 2));
    expect(voice(box, "hold").filter((s) => s.kind === "set")).toHaveLength(4);
  });

  it("swells the hold voice up and back down within the hold", () => {
    const box = buildBreathAudioSchedule(buildBreathePlan("box", 1));
    const hold = voice(box, "hold");
    const at = (atMs: number) => hold.find((step) => step.atMs === atMs);

    // Box is inhale 5s, hold 5s, exhale 5s, hold 5s — so each arch opens on its
    // leg, peaks halfway through, and is back to true silence by the end.
    expect(hold[0]).toEqual({
      voice: "hold",
      atMs: 5000,
      value: 0,
      kind: "set",
    });
    expect(at(7500)?.value).toBe(1);
    expect(at(10000)?.value).toBe(0);
    expect(at(17500)?.value).toBe(1);
    expect(at(20000)?.value).toBe(0);
  });

  // A hold is a timing to the value the breath voice already holds, so it needs
  // no entry of its own — Web Audio sustains the last one.
  it("schedules nothing on the breath voice during a hold", () => {
    const box = buildBreathAudioSchedule(buildBreathePlan("box", 1));
    const during = voice(box, "breath").filter(
      (step) => step.atMs > 5000 && step.atMs < 10000,
    );
    expect(during).toEqual([]);
  });
});
