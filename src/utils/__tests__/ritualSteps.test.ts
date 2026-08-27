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

  // DEX-149: the evening closes on Preview tomorrow, not a Summary — its last
  // question is about the day ahead, not a third reading of the one reviewed.
  it("lists the evening steps in order, ending on the preview", () => {
    expect(RITUAL_STEPS.pm.map((step) => step.title)).toEqual([
      // DEX-164: the evening opens on a breath rather than on its task list.
      "Breathe",
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

  // DEX-140: the calendar step follows its preference like the journal's; the
  // evening ritual has no calendar step, so turning it off changes nothing there.
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

  // DEX-142: the horoscope is the morning's *first* step, so this toggle alone
  // changes which step the ritual opens on.
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

  // Stable references, swept exhaustively: `STEP_LISTS` is precomputed per key,
  // so a key fallen out of `TOGGLE_KEYS` returns `undefined`, not a stale list.
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

  // The range check alone passes NaN (every comparison false) into `state.step`,
  // where `currentStep` returns undefined; the iOS switcher's `Number()` is the source.
  it.each([NaN, 1.5, Infinity])(
    "returns the same state for a non-index %p",
    (index) => {
      const before = state({ step: 2 });

      expect(goToStep(before, index)).toBe(before);
    },
  );

  // The bound is the *derived* list's length, not the mode's (DEX-164) — a
  // toggle still shrinks either ritual under a mounted screen.
  it("bounds against the active ritual's own length", () => {
    expect(goToStep(state({ mode: "pm" }), 4)).toMatchObject({ step: 4 });
    expect(
      goToStep(state({ mode: "pm", journalEnabled: false }), 4),
    ).toMatchObject({ step: 0 });
  });
});

describe("withDate", () => {
  // DEX-138: the step is the question, the date only which day answers it —
  // otherwise every visited day costs another full lap of the ritual.
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

  // Safe only because a date move cannot change the list it indexes — unlike
  // `withMode`, which restarts at 0 for exactly that reason.
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

  // The date is part of `ritualPageKey`, so the page still remounts and re-seeds
  // for the new day — otherwise staying put would show the old day's content.
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
    expect(currentStep(state({ mode: "pm", step: 0 })).title).toBe("Breathe");
  });

  // The last index is whatever the *derived* list makes it — a toggle changes
  // it under a mounted screen, so the check reads the active list, not a constant.
  it("knows both ends of each ritual", () => {
    expect(isFirstStep(state())).toBe(true);
    expect(isLastStep(state())).toBe(false);
    expect(isLastStep(state({ step: 4 }))).toBe(true);
    expect(isLastStep(state({ mode: "pm", step: 4 }))).toBe(true);
    expect(isLastStep(state({ mode: "pm", step: 3 }))).toBe(false);
    // Four evening steps with the journal off, so the end moves in a step.
    expect(
      isLastStep(state({ mode: "pm", journalEnabled: false, step: 3 })),
    ).toBe(true);
  });
});

describe("withJournalEnabled", () => {
  it("returns the same state when the preference hasn't changed", () => {
    const before = state({ step: 2 });

    expect(withJournalEnabled(before, true)).toBe(before);
  });

  // Removing journal shifts every later step down one; a clamp never fires for
  // those (still in range) and would silently move Calendar to Backlog.
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
    const before = state({ mode: "pm", journalEnabled: false, step: 3 });
    expect(currentStep(before).title).toBe("Preview tomorrow");

    const next = withJournalEnabled(before, true);

    expect(currentStep(next).title).toBe("Preview tomorrow");
    expect(next.step).toBe(4);
  });
});

describe("withCalendarEnabled", () => {
  // `ritual/index.tsx` compares this flag against preferences *during render*
  // and sets state on disagreement — an unchanged flag would spin forever.
  it("returns the same state when the preference hasn't changed", () => {
    const before = state({ step: 2 });

    expect(withCalendarEnabled(before, true)).toBe(before);
  });

  it("updates the flag even when the step list doesn't change", () => {
    const next = withCalendarEnabled(state({ mode: "pm", step: 3 }), false);

    expect(next.calendarEnabled).toBe(false);
    expect(currentStep(next).title).toBe("Journal");
  });

  it("keeps the user on the same step by id when the calendar is removed", () => {
    const next = withCalendarEnabled(state({ step: 3 }), false);

    expect(currentStep(next).title).toBe("Backlog");
    expect(next.step).toBe(2);
    expect(next.direction).toBe(0);
  });

  // The cold-launch shape, a direction the journal never runs: calendar defaults
  // *off*, so an enabled user's ritual gains the step a moment after mount.
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
  // Same as the other two: the flag is compared against preferences *during
  // render*, so a transition returning an unchanged flag would spin forever.
  it("returns the same state when the preference hasn't changed", () => {
    const before = state({ step: 2 });

    expect(withHoroscopeEnabled(before, true)).toBe(before);
  });

  it("updates the flag even when the step list doesn't change", () => {
    // The evening has no horoscope step, so the flag write is the whole effect
    // — and the case that would hang the render loop if it went unwritten.
    const next = withHoroscopeEnabled(state({ mode: "pm", step: 3 }), false);

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

  // Horoscope is index 0 — no earlier step to fall back to, so the clamp lands
  // on the *new* list's index 0. The one toggle that can move a ritual's start.
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

  // A journal link with the journal disabled: no step to land on, so the ritual
  // opens where it would have anyway rather than guessing at a neighbour.
  it("leaves the step alone when the linked one isn't in this ritual", () => {
    const before = state({ journalEnabled: false, step: 2 });

    expect(withLink(before, { date: null, step: "journal" })).toBe(before);
    expect(withLink(before, { date: null, step: "review" })).toBe(before);
  });

  it("switches ritual when the link names a mode", () => {
    const next = withLink(state(), { date: null, mode: "pm", step: null });

    expect(next.mode).toBe("pm");
  });

  // `withMode` restarts at step 0, so mode-after-step would silently discard
  // the step. `review` is evening-only, making an order flip fail loudly.
  it("applies the mode before the step, not after", () => {
    const next = withLink(state(), {
      date: null,
      mode: "pm",
      step: "review",
    });

    expect(next.mode).toBe("pm");
    expect(currentStep(next).title).toBe("Review");
    expect(next.step).not.toBe(0);
  });

  // The screenshot run's case: horoscope exists only in the morning, so a link
  // naming it has to be able to reach it from an evening state.
  it("reaches a morning-only step from the evening ritual", () => {
    const evening = state({ mode: "pm", step: 2 });

    const next = withLink(evening, {
      date: null,
      mode: "am",
      step: "horoscope",
    });

    expect(next.mode).toBe("am");
    expect(currentStep(next).title).toBe("Horoscope");
  });

  it("still applies the date alongside a mode", () => {
    const next = withLink(state(), {
      date: DATE.add({ days: 1 }),
      mode: "pm",
      step: "review",
    });

    expect(next.date.toString()).toBe("2026-08-10");
    expect(next.mode).toBe("pm");
    expect(currentStep(next).title).toBe("Review");
  });

  it("returns the same state when the named mode is already current", () => {
    const before = state({ step: 2 });

    expect(withLink(before, { date: null, mode: "am", step: null })).toBe(
      before,
    );
  });
});
