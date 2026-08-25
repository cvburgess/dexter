import { Temporal } from "@js-temporal/polyfill";

import {
  BREATH_AUDIO_MAX_EVENTS_PER_PARAM,
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
  type TBreathAudioCurve,
  type TBreathPhase,
  type TBreathAudioVoice,
  type TBreathingTechnique,
} from "../breathing";

const isIncreasing = (values: readonly number[]): boolean =>
  values.every((value, index) => index === 0 || value > values[index - 1]);

describe("BREATHING_TECHNIQUES", () => {
  /** The total time one cycle spends in a phase. */
  const msIn = (technique: TBreathingTechnique, phase: TBreathPhase) =>
    BREATHING_TECHNIQUES[technique].cycle
      .filter((leg) => leg.phase === phase)
      .reduce((sum, leg) => sum + leg.ms, 0);

  it("matches the durations DEX-164 specifies", () => {
    expect(BREATHING_TECHNIQUES.simple.cycle).toEqual([
      { phase: "inhale", ms: 6000 },
      { phase: "exhale", ms: 6000 },
    ]);
    expect(BREATHING_TECHNIQUES.relax.cycle).toEqual([
      { phase: "inhale", ms: 6000 },
      { phase: "exhale", ms: 8000 },
    ]);
    expect(BREATHING_TECHNIQUES.box.cycle).toEqual([
      { phase: "inhale", ms: 5000 },
      { phase: "hold", ms: 5000 },
      { phase: "exhale", ms: 5000 },
      { phase: "hold", ms: 5000 },
    ]);
  });

  // The table above shipped with Relax inverted, and the exact-value test did
  // not catch it — it asserted whatever the implementation said. These assert
  // what each technique is *for*, which is the part a wrong number contradicts.
  it("gives Relax a longer exhale than inhale, which is the whole technique", () => {
    // A trailing exhale is what engages the parasympathetic response. Inverted,
    // Relax is just a slower Simple that happens to feel like work.
    expect(msIn("relax", "exhale")).toBeGreaterThan(msIn("relax", "inhale"));
  });

  it("keeps Simple even and Box square", () => {
    expect(msIn("simple", "inhale")).toBe(msIn("simple", "exhale"));
    // Box is four equal legs — that is what the name means, and an uneven one
    // would still animate and still sound fine.
    const box = BREATHING_TECHNIQUES.box.cycle;
    expect(new Set(box.map((leg) => leg.ms)).size).toBe(1);
    expect(box.map((leg) => leg.phase)).toEqual([
      "inhale",
      "hold",
      "exhale",
      "hold",
    ]);
  });

  it("never opens a cycle on anything but an inhale", () => {
    // A cycle starting mid-breath would leave the fill rising from wherever the
    // last one left it, and the audio opening on a release.
    for (const technique of BREATHING_TECHNIQUE_ORDER) {
      expect(BREATHING_TECHNIQUES[technique].cycle[0].phase).toBe("inhale");
    }
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

// Kept deliberately thin: the voicing and envelopes are still being tuned by
// ear, so anything pinning exact chords or curve shapes would be rewritten every
// pass. These are the structural facts that survive the tuning.
describe("buildBreathAudioSchedule", () => {
  const voice = (
    schedule: readonly TBreathAudioCurve[],
    which: TBreathAudioVoice,
  ) => schedule.filter((curve) => curve.voice === which);

  const endMs = (curve: TBreathAudioCurve) => curve.atMs + curve.durationMs;

  it.each(BREATHING_TECHNIQUE_ORDER)(
    "keeps every voice in time order, opening and closing on silence (%s)",
    (technique) => {
      const schedule = buildBreathAudioSchedule(buildBreathePlan(technique, 3));
      expect(schedule.length).toBeGreaterThan(0);

      for (const which of [
        "inhale",
        "inhaleHold",
        "exhale",
        "exhaleHold",
      ] as const) {
        const curves = voice(schedule, which);
        if (curves.length === 0) continue;

        // Each curve opens no earlier than the one before it closed. A curve is
        // only legal if nothing lands *inside* its window, so a rise handing
        // straight over to its own fall is the tightest this may ever get.
        for (let i = 1; i < curves.length; i += 1) {
          expect(curves[i].atMs).toBeGreaterThanOrEqual(endMs(curves[i - 1]));
        }
        // A voice that never returns to zero would sustain under the whole rest
        // of the run, which is the one failure here that is silent on a device.
        expect(curves[0].values[0]).toBe(0);
        const closing = curves[curves.length - 1].values;
        expect(closing[closing.length - 1]).toBe(0);
      }
    },
  );

  // Every curve goes straight to `setValueCurveAtTime`, which rejects fewer
  // than two points or a duration that is not strictly positive, and reads the
  // samples as evenly spaced across that duration.
  it.each(BREATHING_TECHNIQUE_ORDER)(
    "hands out curves the audio API will accept (%s)",
    (technique) => {
      for (const curve of buildBreathAudioSchedule(
        buildBreathePlan(technique, MAX_BREATHS),
      )) {
        expect(curve.values.length).toBeGreaterThanOrEqual(2);
        expect(curve.durationMs).toBeGreaterThan(0);
        for (const value of curve.values) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    },
  );

  // `setValueCurveAtTime` throws outright when a curve's window is not clear,
  // so this is not a matter of taste: any curve of the same voice opening at or
  // before another's close kills the whole run rather than sounding slightly
  // off. Asserted with a strict `>` so the schedule can never drift back onto
  // the knife-edge of exact adjacency, where a single ULP decides it.
  it.each(BREATHING_TECHNIQUE_ORDER)(
    "leaves daylight between one curve and the next on a voice (%s)",
    (technique) => {
      const schedule = buildBreathAudioSchedule(
        buildBreathePlan(technique, MAX_BREATHS),
      );

      for (const which of [
        "inhale",
        "inhaleHold",
        "exhale",
        "exhaleHold",
      ] as const) {
        const curves = voice(schedule, which);
        for (let i = 1; i < curves.length; i += 1) {
          expect(curves[i].atMs).toBeGreaterThan(endMs(curves[i - 1]));
        }
      }
    },
  );

  // The two holds are told apart by the leg before them, and Box is the only
  // technique that has any.
  it("gives each hold its own voice, and only where the technique holds", () => {
    const box = buildBreathAudioSchedule(buildBreathePlan("box", 2));
    expect(voice(box, "inhaleHold").length).toBeGreaterThan(0);
    expect(voice(box, "exhaleHold").length).toBeGreaterThan(0);

    for (const technique of ["simple", "relax"] as const) {
      const schedule = buildBreathAudioSchedule(buildBreathePlan(technique, 3));
      expect(voice(schedule, "inhaleHold")).toEqual([]);
      expect(voice(schedule, "exhaleHold")).toEqual([]);
    }
  });

  // Which hold is which is derived from `levels`, not from the leg's own phase —
  // both are just `"hold"`. Swap the two and the cycle stops arching: the tone
  // would drop after the inhale and climb after the exhale, which is legible on
  // a device and invisible everywhere else.
  it("puts the high hold after the inhale and the low one after the exhale", () => {
    const box = buildBreathAudioSchedule(buildBreathePlan("box", 1));
    // Box is inhale 0-5s, hold 5-10s, exhale 10-15s, hold 15-20s.
    expect(voice(box, "inhaleHold")[0].atMs).toBe(5000);
    expect(voice(box, "exhaleHold")[0].atMs).toBe(15000);
  });

  // Every leg has to actually get *loud* — an attack that never lands leaves the
  // phase audible but never at full, which is exactly the kind of wrong that
  // sounds merely "off" rather than broken.
  it.each(BREATHING_TECHNIQUE_ORDER)(
    "brings every leg to full inside its own leg (%s)",
    (technique) => {
      const plan = buildBreathePlan(technique, 2);
      const schedule = buildBreathAudioSchedule(plan);

      let elapsed = 0;
      for (const leg of plan.session) {
        const start = elapsed;
        const end = start + leg.ms;
        // Some curve opens with this leg, reaches full, and is done inside it.
        // Two curves open here — the previous leg's fall lands on the same
        // boundary — so this asserts one of them rises rather than assuming
        // which comes first in the array.
        const rises = schedule.filter(
          (curve) =>
            curve.atMs === start &&
            curve.values[curve.values.length - 1] === 1 &&
            endMs(curve) <= end,
        );
        expect(rises).toHaveLength(1);
        elapsed = end;
      }
    },
  );

  // A release that outran the gap to the same voice's next rise would have the
  // tone fighting its own next entry — silent in every test that does not look
  // for it, and the reason RELEASE_RATIO is a fraction rather than a duration.
  it.each(BREATHING_TECHNIQUE_ORDER)(
    "finishes each release before that voice sounds again (%s)",
    (technique) => {
      const schedule = buildBreathAudioSchedule(
        buildBreathePlan(technique, MAX_BREATHS),
      );

      for (const which of [
        "inhale",
        "inhaleHold",
        "exhale",
        "exhaleHold",
      ] as const) {
        const curves = voice(schedule, which);
        // A voice alternates rise, fall, rise, fall — so every fall has to
        // reach zero and be done before the rise after it opens.
        for (let i = 1; i < curves.length; i += 2) {
          const fall = curves[i];
          expect(fall.values[fall.values.length - 1]).toBe(0);
          const nextRise = curves[i + 1];
          if (nextRise) expect(endMs(fall)).toBeLessThanOrEqual(nextRise.atMs);
        }
      }
    },
  );

  // The library bounds a param's queues at this and drops the overflow in
  // silence (see the constant's own comment). Two events a leg, plus the hook's
  // opening `setValueAtTime(0)` that gates a voice before its first curve.
  it.each(BREATHING_TECHNIQUE_ORDER)(
    "leaves every voice inside the per-param event budget (%s)",
    (technique) => {
      const schedule = buildBreathAudioSchedule(
        buildBreathePlan(technique, MAX_BREATHS),
      );

      const perVoice = new Map<TBreathAudioVoice, number>();
      for (const curve of schedule) {
        perVoice.set(curve.voice, (perVoice.get(curve.voice) ?? 0) + 1);
      }

      expect(perVoice.size).toBeGreaterThan(0);
      for (const events of perVoice.values()) {
        expect(events + 1).toBeLessThanOrEqual(
          BREATH_AUDIO_MAX_EVENTS_PER_PARAM,
        );
      }
    },
  );
});
