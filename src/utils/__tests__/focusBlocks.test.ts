import {
  formatCountdown,
  liveRemainingSeconds,
  resolveFocusBlockMinutes,
  TFocusAnchor,
} from "../focusBlocks";

const START = Date.parse("2026-08-13T10:00:00.000Z");

const anchor = (overrides: Partial<TFocusAnchor> = {}): TFocusAnchor => ({
  status: "active",
  remainingSeconds: 1500,
  resumedAt: new Date(START).toISOString(),
  ...overrides,
});

describe("liveRemainingSeconds", () => {
  it("subtracts however long the block has been running", () => {
    expect(liveRemainingSeconds(anchor(), START + 60_000)).toBe(1440);
  });

  // The whole point of the anchor: a paused block's snapshot is the answer
  // regardless of wall-clock time. If this ever reads the clock, pause breaks.
  it("returns a paused block's snapshot however much time passes", () => {
    const paused = anchor({ status: "paused", resumedAt: null });

    expect(liveRemainingSeconds(paused, START)).toBe(1500);
    expect(liveRemainingSeconds(paused, START + 86_400_000)).toBe(1500);
  });

  // The app-was-closed path: the publisher completes any block that reads zero
  // at mount, so this must clamp rather than go negative.
  it("clamps to zero once the end has passed", () => {
    expect(liveRemainingSeconds(anchor(), START + 3_600_000)).toBe(0);
  });

  // A resume's fresh anchor is as stale as the pause was long; unclamped, that
  // negative elapsed would add the pause back and jump the timer upward.
  it("never reads above the snapshot for a clock behind the anchor", () => {
    const resumed = anchor({
      remainingSeconds: 900,
      resumedAt: new Date(START + 600_000).toISOString(),
    });

    expect(liveRemainingSeconds(resumed, START)).toBe(900);
  });

  it("has nothing left for a block that already ended", () => {
    expect(
      liveRemainingSeconds(
        anchor({ status: "complete", resumedAt: null }),
        START,
      ),
    ).toBe(0);
    expect(
      liveRemainingSeconds(
        anchor({ status: "cancelled", resumedAt: null }),
        START,
      ),
    ).toBe(0);
  });
});

describe("formatCountdown", () => {
  // Rounds up, so a fresh 25-minute block reads 25:00 for its whole first
  // second instead of dropping to 24:59 the moment it starts.
  it("rounds up to the whole second", () => {
    expect(formatCountdown(1500)).toBe("25:00");
    expect(formatCountdown(1499.2)).toBe("25:00");
    expect(formatCountdown(1499)).toBe("24:59");
  });

  it("pads the seconds but not the minutes", () => {
    expect(formatCountdown(7)).toBe("0:07");
    expect(formatCountdown(70)).toBe("1:10");
  });

  it("shows nothing left rather than a negative", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  // Keeps counting in minutes past the hour rather than growing an hours field,
  // so the glyph count never changes inside the tab-bar accessory's capsule.
  it("keeps counting minutes at an hour", () => {
    expect(formatCountdown(3600)).toBe("60:00");
  });
});

describe("resolveFocusBlockMinutes", () => {
  it("keeps a length this build offers", () => {
    expect(resolveFocusBlockMinutes(50)).toBe(50);
  });

  // Unconstrained column, so an older build can read a newer build's choice;
  // without this the Picker renders nothing selected.
  it("falls back to 25 for a length it doesn't", () => {
    expect(resolveFocusBlockMinutes(37)).toBe(25);
    expect(resolveFocusBlockMinutes(0)).toBe(25);
  });
});
