import { Temporal } from "@js-temporal/polyfill";

import {
  parseRitualLink,
  parseRitualStep,
  ritualRoute,
} from "@/utils/ritualRoute";

describe("ritualRoute", () => {
  it("returns the bare tab route when given nothing to point at", () => {
    expect(ritualRoute()).toBe("/ritual");
  });

  it("drops params that were left undefined or blank", () => {
    expect(ritualRoute({ date: "2026-07-12", step: "journal", n: "" })).toEqual(
      {
        pathname: "/ritual",
        params: { date: "2026-07-12", step: "journal" },
      },
    );
  });

  // Deliberate: the journal is a step of both rituals, so the tab picks the
  // morning or evening flow by the clock rather than the link pinning one.
  it("names a step but never a mode", () => {
    expect(ritualRoute({ step: "journal" })).toEqual({
      pathname: "/ritual",
      params: { step: "journal" },
    });
  });
});

describe("parseRitualStep", () => {
  it("accepts a real step id", () => {
    expect(parseRitualStep("journal")).toBe("journal");
    expect(parseRitualStep("preview-tomorrow")).toBe("preview-tomorrow");
  });

  it("rejects an unknown step rather than passing it through", () => {
    // The route is linkable on web, so a hand-edited URL is a real input — and
    // an unrecognized id would otherwise reach `goToStep` as a -1 index.
    expect(parseRitualStep("not-a-step")).toBeNull();
    expect(parseRitualStep(undefined)).toBeNull();
    expect(parseRitualStep("")).toBeNull();
  });

  it("takes the first value when a param is repeated in the URL", () => {
    expect(parseRitualStep(["journal", "tasks"])).toBe("journal");
  });
});

describe("parseRitualLink", () => {
  it("returns null when the route names neither a day nor a step", () => {
    // An ordinary tab press — the ritual must open on the clock's mode at step
    // 0, rather than applying an empty link.
    expect(parseRitualLink({})).toBeNull();
    expect(parseRitualLink({ n: "1" })).toBeNull();
  });

  it("reads the day and step a search result asked for", () => {
    const link = parseRitualLink({
      date: "2026-07-12",
      step: "journal",
      n: "1",
    });

    expect(link?.date).toEqual(Temporal.PlainDate.from("2026-07-12"));
    expect(link?.step).toBe("journal");
  });

  it("gives two follows of the same link different ids", () => {
    // Cross-tab navigation reuses the mounted Ritual screen and only swaps its
    // params, so a value-based comparison can't tell "already applied" from
    // "applied, user navigated away, and asked again".
    const first = parseRitualLink({
      date: "2026-07-12",
      step: "journal",
      n: "1",
    });
    const second = parseRitualLink({
      date: "2026-07-12",
      step: "journal",
      n: "2",
    });

    expect(first?.id).not.toBe(second?.id);
  });

  it("gives a link with no nonce a stable id, so it applies exactly once", () => {
    const link = parseRitualLink({ date: "2026-07-12", step: "journal" });
    const again = parseRitualLink({ date: "2026-07-12", step: "journal" });

    expect(link?.id).toBe(again?.id);
  });

  it("narrows repeated params and drops an unparseable date", () => {
    const link = parseRitualLink({
      date: ["2026-02-30"],
      step: ["journal", "tasks"],
      n: ["1"],
    });

    expect(link?.date).toBeNull();
    expect(link?.step).toBe("journal");
  });

  it("survives a link naming only an unknown step", () => {
    // Nothing to apply, so it reads as an ordinary tab press rather than
    // producing a link the screen would try (and fail) to honor.
    expect(parseRitualLink({ step: "not-a-step", n: "1" })).toBeNull();
  });
});
