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
  withCalendarEnabled,
  withDate,
  withHoroscopeEnabled,
  withJournalEnabled,
  withLink,
  withMode,
  type TRitualState,
} from "../ritualSteps";

const DATE = Temporal.PlainDate.from("2026-08-09");
const TOMORROW = DATE.add({ days: 1 });

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
      "Summary",
    ]);
  });

  // The evening closes on Preview tomorrow, not on a Summary (DEX-149): a count
  // of the day you have just finished reviewing is a third reading of it, where
  // the last question the evening actually has is about the day ahead.
  it("lists the evening steps in order, ending on the preview", () => {
    expect(RITUAL_STEPS.pm.map((step) => step.title)).toEqual([
      "Open tasks",
      "Review",
      "Journal",
      "Preview tomorrow",
    ]);
  });

  it("keeps the summary in the morning only", () => {
    expect(RITUAL_STEPS.am.map((step) => step.id)).toContain("summary");
    expect(RITUAL_STEPS.pm.map((step) => step.id)).not.toContain("summary");
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
      calendarEnabled: true,
      horoscopeEnabled: true,
    });
  });

  it("carries the step preferences into the state", () => {
    expect(
      createRitualState(DATE, "am", { journalEnabled: false }),
    ).toMatchObject({
      journalEnabled: false,
      calendarEnabled: true,
      horoscopeEnabled: true,
    });
    expect(
      createRitualState(DATE, "am", { calendarEnabled: false }),
    ).toMatchObject({
      journalEnabled: true,
      calendarEnabled: false,
      horoscopeEnabled: true,
    });
    expect(
      createRitualState(DATE, "am", { horoscopeEnabled: false }),
    ).toMatchObject({
      journalEnabled: true,
      calendarEnabled: true,
      horoscopeEnabled: false,
    });
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

  // DEX-140: the calendar step only exists for a user who has a calendar, the
  // same way the journal step follows its own preference. The evening ritual
  // has no calendar step, so turning it off changes nothing there.
  it("drops the morning calendar step when the calendar is disabled", () => {
    const ids = stepsFor(state({ calendarEnabled: false })).map(
      (step) => step.id,
    );

    expect(ids).not.toContain("calendar");
    expect(ids).toHaveLength(RITUAL_STEPS.am.length - 1);
  });

  it("leaves the evening ritual alone when the calendar is disabled", () => {
    expect(
      stepsFor(state({ mode: "pm", calendarEnabled: false })).map(
        (step) => step.id,
      ),
    ).toEqual(RITUAL_STEPS.pm.map((step) => step.id));
  });

  it("drops both steps when both are disabled", () => {
    const ids = stepsFor(
      state({ journalEnabled: false, calendarEnabled: false }),
    ).map((step) => step.id);

    expect(ids).toEqual(["horoscope", "backlog", "summary"]);
  });

  // DEX-142: the horoscope is opt-out, and it is the morning ritual's *first*
  // step — so turning it off changes which step the ritual opens on, which no
  // other toggle does.
  it("drops the morning horoscope step when the horoscope is disabled", () => {
    const ids = stepsFor(state({ horoscopeEnabled: false })).map(
      (step) => step.id,
    );

    expect(ids).not.toContain("horoscope");
    expect(ids[0]).toBe("journal");
    expect(ids).toHaveLength(RITUAL_STEPS.am.length - 1);
  });

  it("leaves the evening ritual alone when the horoscope is disabled", () => {
    expect(
      stepsFor(state({ mode: "pm", horoscopeEnabled: false })).map(
        (step) => step.id,
      ),
    ).toEqual(RITUAL_STEPS.pm.map((step) => step.id));
  });

  it("drops all three steps when all three are disabled", () => {
    const ids = stepsFor(
      state({
        journalEnabled: false,
        calendarEnabled: false,
        horoscopeEnabled: false,
      }),
    ).map((step) => step.id);

    expect(ids).toEqual(["backlog", "summary"]);
  });

  // Stable references, not fresh arrays: both switchers map this on every
  // render, and the route compares against it to detect a preference change.
  // Every combination, because `STEP_LISTS` is precomputed per key — a key that
  // fell out of `TOGGLE_KEYS` would return `undefined` here rather than a stale
  // list, and only an exhaustive sweep catches it.
  it.each(
    [false, true].flatMap((journalEnabled) =>
      [false, true].flatMap((calendarEnabled) =>
        [false, true].map((horoscopeEnabled) => ({
          journalEnabled,
          calendarEnabled,
          horoscopeEnabled,
        })),
      ),
    ),
  )("returns the same array for the same inputs (%p)", (toggles) => {
    expect(stepsFor(state(toggles))).toBe(stepsFor(state(toggles)));
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

  // The evening ritual is a step shorter than the morning one, so the same
  // index can be valid in one mode and out of range in the other.
  it("bounds against the active ritual's own length", () => {
    expect(goToStep(state({ mode: "am" }), 4)).toMatchObject({ step: 4 });
    expect(goToStep(state({ mode: "pm" }), 4)).toMatchObject({ step: 0 });
  });
});

describe("withDate", () => {
  // DEX-138: the step is the question, the date is only which day's answer is
  // on screen. Someone comparing yesterday's journal to today's would otherwise
  // walk the whole ritual again for every day they visited.
  it("stays on the current step, travelling forward to a later day", () => {
    const next = withDate(state({ step: 3 }), DATE.add({ days: 1 }));

    expect(next).toMatchObject({ step: 3, direction: 1 });
    expect(next.date.toString()).toBe("2026-08-10");
  });

  it("stays on the current step, travelling back to an earlier day", () => {
    expect(
      withDate(state({ step: 3 }), DATE.subtract({ days: 5 })),
    ).toMatchObject({ step: 3, direction: -1 });
  });

  // Carrying the index across is only safe because the list it indexes cannot
  // change under a date move — unlike `withMode`, which restarts at 0 for
  // exactly that reason.
  it("keeps pointing at the same step in either mode, journal on or off", () => {
    expect(currentStep(withDate(state({ step: 2 }), TOMORROW)).title).toBe(
      currentStep(state({ step: 2 })).title,
    );
    expect(
      currentStep(
        withDate(
          state({ mode: "pm", journalEnabled: false, step: 2 }),
          TOMORROW,
        ),
      ).title,
    ).toBe(
      currentStep(state({ mode: "pm", journalEnabled: false, step: 2 })).title,
    );
  });

  // The date is part of `ritualPageKey`, so the page still remounts and
  // re-seeds for the new day even though the step index never moved — without
  // that, staying put would mean showing the old day's content.
  it("still counts as a new page even though the step did not move", () => {
    const before = state({ step: 3 });

    expect(ritualPageKey(withDate(before, TOMORROW))).not.toBe(
      ritualPageKey(before),
    );
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

  // The last index differs per mode — five morning steps, four evening ones
  // since DEX-149 dropped the summary from the evening — so the check has to
  // read the active list rather than a single constant.
  it("knows both ends of each ritual", () => {
    expect(isFirstStep(state())).toBe(true);
    expect(isLastStep(state())).toBe(false);
    expect(isLastStep(state({ step: 4 }))).toBe(true);
    expect(isLastStep(state({ mode: "pm", step: 3 }))).toBe(true);
    expect(isLastStep(state({ mode: "pm", step: 2 }))).toBe(false);
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

  it("keeps the evening's last step by id when the journal is added back", () => {
    // Read backwards: the step that was last with the journal gone is no longer
    // last once it returns, so an index carried across would land short of it.
    const before = state({ mode: "pm", journalEnabled: false, step: 2 });
    expect(currentStep(before).title).toBe("Preview tomorrow");

    const next = withJournalEnabled(before, true);

    expect(currentStep(next).title).toBe("Preview tomorrow");
    expect(next.step).toBe(3);
  });
});

describe("withCalendarEnabled", () => {
  // Identity matters as much here as anywhere: `ritual/index.tsx` compares this
  // flag against preferences *during render* and sets state when they disagree,
  // so a transition that returned an unchanged flag would spin forever.
  it("returns the same state when the preference hasn't changed", () => {
    const before = state({ step: 2 });

    expect(withCalendarEnabled(before, true)).toBe(before);
  });

  it("updates the flag even when the step list doesn't change", () => {
    const next = withCalendarEnabled(state({ mode: "pm", step: 2 }), false);

    expect(next.calendarEnabled).toBe(false);
    expect(currentStep(next).title).toBe("Journal");
  });

  it("keeps the user on the same step by id when the calendar is removed", () => {
    const next = withCalendarEnabled(state({ step: 3 }), false);

    expect(currentStep(next).title).toBe("Backlog");
    expect(next.step).toBe(2);
    expect(next.direction).toBe(0);
  });

  // The cold-launch shape, and the direction the journal never runs in: the
  // calendar preference defaults to *off*, so an enabled user's ritual gains
  // the step a moment after mount.
  it("keeps the user on the same step by id when the calendar is added", () => {
    const before = state({ calendarEnabled: false, step: 2 });

    expect(currentStep(before).title).toBe("Backlog");
    expect(currentStep(withCalendarEnabled(before, true)).title).toBe(
      "Backlog",
    );
  });

  it("leaves the page key alone when the step survives", () => {
    const before = state({ step: 3 });

    expect(ritualPageKey(withCalendarEnabled(before, false))).toBe(
      ritualPageKey(before),
    );
  });

  it("falls back to the nearest step when the calendar itself was on screen", () => {
    const next = withCalendarEnabled(state({ step: 2 }), false);

    expect(next.step).toBe(2);
    expect(currentStep(next).title).toBe("Backlog");
  });

  it("repairs the step with the journal already gone", () => {
    // Journal off puts Calendar at index 1; removing it too has to land on
    // Backlog, not on whatever index 1 used to mean.
    const before = state({ journalEnabled: false, step: 1 });

    expect(currentStep(before).title).toBe("Calendar");
    expect(currentStep(withCalendarEnabled(before, false)).title).toBe(
      "Backlog",
    );
  });
});

describe("withHoroscopeEnabled", () => {
  // Same reason as the other two: `ritual/index.tsx` compares this flag against
  // preferences *during render*, so a transition returning an unchanged flag
  // would spin forever.
  it("returns the same state when the preference hasn't changed", () => {
    const before = state({ step: 2 });

    expect(withHoroscopeEnabled(before, true)).toBe(before);
  });

  it("updates the flag even when the step list doesn't change", () => {
    // The evening ritual has no horoscope step at all, so this is the whole
    // effect there — and the case that would hang the render loop if the flag
    // went unwritten.
    const next = withHoroscopeEnabled(state({ mode: "pm", step: 2 }), false);

    expect(next.horoscopeEnabled).toBe(false);
    expect(currentStep(next).title).toBe("Journal");
  });

  it("keeps the user on the same step by id when the horoscope is removed", () => {
    const next = withHoroscopeEnabled(state({ step: 3 }), false);

    expect(currentStep(next).title).toBe("Backlog");
    expect(next.step).toBe(2);
    expect(next.direction).toBe(0);
  });

  it("keeps the user on the same step by id when the horoscope is added", () => {
    const before = state({ horoscopeEnabled: false, step: 2 });

    expect(currentStep(before).title).toBe("Backlog");
    expect(currentStep(withHoroscopeEnabled(before, true)).title).toBe(
      "Backlog",
    );
  });

  it("leaves the page key alone when the step survives", () => {
    const before = state({ step: 3 });

    expect(ritualPageKey(withHoroscopeEnabled(before, false))).toBe(
      ritualPageKey(before),
    );
  });

  // The horoscope is index 0, so there is no earlier step to fall back to: the
  // clamp lands on index 0 of the *new* list, which is whatever now opens the
  // ritual. This is the one toggle that can change where a ritual starts.
  it("moves to the new first step when the horoscope itself was on screen", () => {
    const next = withHoroscopeEnabled(state({ step: 0 }), false);

    expect(next.step).toBe(0);
    expect(currentStep(next).title).toBe("Journal");
  });

  it("moves to Calendar when the journal is off too", () => {
    const before = state({ journalEnabled: false, step: 0 });

    expect(currentStep(before).title).toBe("Horoscope");
    expect(currentStep(withHoroscopeEnabled(before, false)).title).toBe(
      "Calendar",
    );
  });

  it("repairs the step with the journal already gone", () => {
    // Journal off puts Calendar at index 1; removing the horoscope shifts it to
    // index 0, and the user has to travel with it rather than sit on the index.
    const before = state({ journalEnabled: false, step: 1 });

    expect(currentStep(before).title).toBe("Calendar");

    const next = withHoroscopeEnabled(before, false);

    expect(next.step).toBe(0);
    expect(currentStep(next).title).toBe("Calendar");
  });
});

describe("withLink", () => {
  it("applies the day and the step as one transition", () => {
    // One state, so the screen never renders the link's date against the
    // pre-link step for a frame.
    const next = withLink(state(), {
      date: DATE.add({ days: 1 }),
      step: "summary",
    });

    expect(next.date.toString()).toBe("2026-08-10");
    expect(currentStep(next).title).toBe("Summary");
  });

  it("applies a step on its own", () => {
    expect(
      currentStep(withLink(state(), { date: null, step: "journal" })).title,
    ).toBe("Journal");
  });

  // A link carrying only a date moves the day and stays put, since `withDate`
  // no longer restarts the ritual (DEX-138).
  it("applies a day on its own, keeping the step", () => {
    const next = withLink(state({ step: 3 }), {
      date: DATE.add({ days: 1 }),
      step: null,
    });

    expect(next).toMatchObject({ step: 3, direction: 1 });
    expect(next.date.toString()).toBe("2026-08-10");
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
