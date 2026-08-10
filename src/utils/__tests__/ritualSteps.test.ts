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
  RITUAL_STEPS,
  ritualPageKey,
  stepsFor,
  withDate,
  withJournalEnabled,
  withLink,
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

describe("createRitualState", () => {
  it("opens on the first step with no travel direction", () => {
    expect(createRitualState(DATE, "pm")).toEqual({
      date: DATE,
      mode: "pm",
      step: 0,
      direction: 0,
      journalEnabled: true,
    });
  });

  it("carries the journal preference into the state", () => {
    expect(createRitualState(DATE, "am", false).journalEnabled).toBe(false);
  });
});

describe("stepsFor", () => {
  it.each(["am", "pm"] as const)(
    "drops the %s journal step when the journal is disabled",
    (mode) => {
      const ids = stepsFor(state({ mode, journalEnabled: false })).map(
        (step) => step.id,
      );

      expect(ids).not.toContain("journal");
      expect(ids).toHaveLength(RITUAL_STEPS[mode].length - 1);
    },
  );

  // Stable references, not fresh arrays: both switchers map this on every
  // render, and the route compares against it to detect a preference change.
  it("returns the same array for the same inputs", () => {
    expect(stepsFor(state())).toBe(stepsFor(state()));
    expect(stepsFor(state({ journalEnabled: false }))).toBe(
      stepsFor(state({ journalEnabled: false })),
    );
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

  // The range check alone doesn't reject these — every comparison against NaN
  // is false — so one would land in `state.step`, where `currentStep` returns
  // undefined and every caller reading `step.id` throws. The iOS switcher
  // coerces a raw selection with `Number()`, which is where a NaN would come
  // from.
  it.each([NaN, 1.5, Infinity])(
    "returns the same state for a non-index %p",
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

describe("ritualPageKey", () => {
  // Derived in one place so the phone and the large screen can't disagree about
  // what counts as a new page; all three parts have to be in it.
  it("changes with the step, the date and the mode", () => {
    const base = state();

    expect(ritualPageKey(base)).toBe("2026-08-09-am-horoscope");
    expect(ritualPageKey(state({ step: 1 }))).not.toBe(ritualPageKey(base));
    expect(ritualPageKey(withDate(base, DATE.add({ days: 1 })))).not.toBe(
      ritualPageKey(base),
    );
    expect(ritualPageKey(withMode(base, "pm"))).not.toBe(ritualPageKey(base));
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

describe("withJournalEnabled", () => {
  it("returns the same state when the preference hasn't changed", () => {
    const before = state({ step: 2 });

    expect(withJournalEnabled(before, true)).toBe(before);
  });

  // The whole reason this exists rather than a clamp: journal is index 1 of the
  // morning ritual, so removing it shifts Calendar/Backlog/Tasks down one. A
  // clamp never fires for those — they stay in range — and would silently move
  // someone from Calendar to Backlog.
  it("keeps the user on the same step by id when the journal is removed", () => {
    const next = withJournalEnabled(state({ step: 2 }), false);

    expect(currentStep(next).title).toBe("Calendar");
    expect(next.step).toBe(1);
    expect(next.direction).toBe(0);
  });

  it("keeps the user on the same step by id when the journal is added back", () => {
    const before = state({ journalEnabled: false, step: 1 });

    expect(currentStep(before).title).toBe("Calendar");
    expect(currentStep(withJournalEnabled(before, true)).title).toBe(
      "Calendar",
    );
  });

  // Leaving the page key alone is what keeps `SwipeablePage` from remounting
  // and replaying its intro for a toggle flipped in another tab.
  it("leaves the page key alone when the step survives", () => {
    const before = state({ step: 2 });

    expect(ritualPageKey(withJournalEnabled(before, false))).toBe(
      ritualPageKey(before),
    );
  });

  it("falls back to the nearest step when the journal itself was on screen", () => {
    const next = withJournalEnabled(state({ step: 1 }), false);

    expect(next.step).toBe(1);
    expect(currentStep(next).title).toBe("Calendar");
  });

  it("clamps to the last step when the removed one was at the end", () => {
    // The evening ritual read backwards: nothing follows a step that is last
    // once the journal is gone, so the clamp is the only repair available.
    const before = state({ mode: "pm", journalEnabled: false, step: 3 });
    const next = withJournalEnabled(before, true);

    expect(currentStep(next).title).toBe("Congrats");
  });
});

describe("withLink", () => {
  it("applies the day and the step as one transition", () => {
    // `withDate` restarts the ritual at step 0, so a date and step applied
    // separately would land on the day's first step, not the one asked for.
    const next = withLink(state(), {
      date: DATE.add({ days: 1 }),
      step: "tasks",
    });

    expect(next.date.toString()).toBe("2026-08-10");
    expect(currentStep(next).title).toBe("Tasks");
  });

  it("applies a step on its own", () => {
    expect(
      currentStep(withLink(state(), { date: null, step: "journal" })).title,
    ).toBe("Journal");
  });

  it("applies a day on its own", () => {
    const next = withLink(state({ step: 3 }), {
      date: DATE.add({ days: 1 }),
      step: null,
    });

    expect(next.step).toBe(0);
  });

  it("returns the same state for an empty link", () => {
    const before = state({ step: 2 });

    expect(withLink(before, { date: null, step: null })).toBe(before);
  });

  // A journal link followed by a user who has the journal disabled: there is no
  // step to land on, so the ritual opens where it would have anyway rather than
  // guessing at a neighbour.
  it("leaves the step alone when the linked one isn't in this ritual", () => {
    const before = state({ journalEnabled: false, step: 2 });

    expect(withLink(before, { date: null, step: "journal" })).toBe(before);
    expect(withLink(before, { date: null, step: "review" })).toBe(before);
  });
});
