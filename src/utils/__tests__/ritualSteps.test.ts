import { Temporal } from "@js-temporal/polyfill";

import {
  advanceStep,
  createRitualState,
  currentStep,
  goToStep,
  isFirstStep,
  isLastStep,
  modeForHour,
  otherMode,
  parseRitualMode,
  RITUAL_STEPS,
  withDate,
  withMode,
  type TRitualState,
} from "../ritualSteps";

const DATE = Temporal.PlainDate.from("2026-08-09");

const state = (overrides: Partial<TRitualState> = {}): TRitualState => ({
  ...createRitualState(DATE, "am"),
  ...overrides,
});

describe("RITUAL_STEPS", () => {
  it("lists the morning steps in order", () => {
    expect(RITUAL_STEPS.am.map((step) => step.title)).toEqual([
      "Horoscope",
      "Journal",
      "Calendar",
      "Backlog",
      "Tasks",
      "Congrats",
    ]);
  });

  it("lists the evening steps in order", () => {
    expect(RITUAL_STEPS.pm.map((step) => step.title)).toEqual([
      "Open tasks",
      "Review",
      "Journal",
      "Preview tomorrow",
      "Congrats",
    ]);
  });

  // The id is half of the swipe pager's remount key, so a duplicate inside one
  // mode would silently stop a step change from remounting.
  it.each(["am", "pm"] as const)("gives every %s step a unique id", (mode) => {
    const ids = RITUAL_STEPS[mode].map((step) => step.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("modeForHour", () => {
  // The noon boundary is a literal requirement (DEX-127), so pin both sides.
  it.each([0, 11])("is the morning ritual at %i:00", (hour) => {
    expect(modeForHour(hour)).toBe("am");
  });

  it.each([12, 13, 23])("is the evening ritual at %i:00", (hour) => {
    expect(modeForHour(hour)).toBe("pm");
  });
});

describe("otherMode", () => {
  it("flips between the two rituals", () => {
    expect(otherMode("am")).toBe("pm");
    expect(otherMode("pm")).toBe("am");
  });
});

describe("parseRitualMode", () => {
  it("accepts the two modes", () => {
    expect(parseRitualMode("am")).toBe("am");
    expect(parseRitualMode("pm")).toBe("pm");
  });

  it("takes the first of a repeated param", () => {
    expect(parseRitualMode(["pm", "am"])).toBe("pm");
  });

  it.each(["AM", "evening", "", undefined])(
    "rejects %p so the caller can fall back to the clock",
    (value) => {
      expect(parseRitualMode(value)).toBeNull();
    },
  );
});

describe("createRitualState", () => {
  it("opens on the first step with no travel direction", () => {
    expect(createRitualState(DATE, "pm")).toEqual({
      date: DATE,
      mode: "pm",
      step: 0,
      direction: 0,
    });
  });
});

describe("advanceStep", () => {
  it("moves forward and records the direction", () => {
    expect(advanceStep(state(), 1)).toMatchObject({ step: 1, direction: 1 });
  });

  it("moves back and records the direction", () => {
    expect(advanceStep(state({ step: 2 }), -1)).toMatchObject({
      step: 1,
      direction: -1,
    });
  });

  // Identity, not just equality: an unchanged object is what keeps a declined
  // swipe from re-rendering and restarting the intro animation.
  it("returns the same state before the first step", () => {
    const before = state();

    expect(advanceStep(before, -1)).toBe(before);
  });

  it("returns the same state past the last step", () => {
    const before = state({ step: RITUAL_STEPS.am.length - 1 });

    expect(advanceStep(before, 1)).toBe(before);
  });
});

describe("goToStep", () => {
  it("jumps forward and records the direction", () => {
    expect(goToStep(state(), 4)).toMatchObject({ step: 4, direction: 1 });
  });

  it("jumps back and records the direction", () => {
    expect(goToStep(state({ step: 4 }), 1)).toMatchObject({
      step: 1,
      direction: -1,
    });
  });

  it("returns the same state for the step already on screen", () => {
    const before = state({ step: 2 });

    expect(goToStep(before, 2)).toBe(before);
  });

  it.each([-1, 6])(
    "returns the same state for out-of-range index %i",
    (index) => {
      const before = state({ step: 2 });

      expect(goToStep(before, index)).toBe(before);
    },
  );

  // The evening ritual is a step shorter, so the same index can be valid in one
  // mode and out of range in the other.
  it("bounds against the active ritual's own length", () => {
    expect(goToStep(state({ mode: "pm" }), 4)).toMatchObject({ step: 4 });
    expect(goToStep(state({ mode: "pm" }), 5)).toMatchObject({ step: 0 });
  });
});

describe("withDate", () => {
  it("restarts the ritual on a later day, travelling forward", () => {
    const next = withDate(state({ step: 3 }), DATE.add({ days: 1 }));

    expect(next).toMatchObject({ step: 0, direction: 1 });
    expect(next.date.toString()).toBe("2026-08-10");
  });

  it("restarts the ritual on an earlier day, travelling back", () => {
    expect(
      withDate(state({ step: 3 }), DATE.subtract({ days: 5 })),
    ).toMatchObject({ step: 0, direction: -1 });
  });

  it("returns the same state for the day already on screen", () => {
    const before = state({ step: 3 });

    expect(withDate(before, DATE)).toBe(before);
  });
});

describe("withMode", () => {
  it("restarts on the evening ritual, travelling forward", () => {
    const next = withMode(state({ step: 4 }), "pm");

    expect(next).toMatchObject({ mode: "pm", step: 0, direction: 1 });
  });

  it("restarts on the morning ritual, travelling back", () => {
    const next = withMode(state({ mode: "pm", step: 3 }), "am");

    expect(next).toMatchObject({ mode: "am", step: 0, direction: -1 });
  });

  it("returns the same state for the mode already on screen", () => {
    const before = state({ step: 3 });

    expect(withMode(before, "am")).toBe(before);
  });
});

describe("step position helpers", () => {
  it("reads the step the state points at", () => {
    expect(currentStep(state({ step: 2 })).title).toBe("Calendar");
    expect(currentStep(state({ mode: "pm", step: 0 })).title).toBe(
      "Open tasks",
    );
  });

  // The last index differs per mode (six morning steps, five evening ones), so
  // the check has to read the active list rather than a single constant.
  it("knows both ends of each ritual", () => {
    expect(isFirstStep(state())).toBe(true);
    expect(isLastStep(state())).toBe(false);
    expect(isLastStep(state({ step: 5 }))).toBe(true);
    expect(isLastStep(state({ mode: "pm", step: 4 }))).toBe(true);
    expect(isLastStep(state({ mode: "pm", step: 3 }))).toBe(false);
  });
});
