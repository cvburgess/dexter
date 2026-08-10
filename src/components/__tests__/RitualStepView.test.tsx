import { Temporal } from "@js-temporal/polyfill";
import { render } from "@testing-library/react-native";

import { RitualStepView } from "@/components/RitualStepView";
import { RITUAL_STEPS, TRitualStepId } from "@/utils/ritualSteps";

// The step owns a query, a preference and a breathing animation, none of which
// this file is about — it is about which step id lands on which view.
jest.mock("@/components/HoroscopeStep", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    HoroscopeStep: function MockHoroscopeStep({
      date,
    }: {
      date: Temporal.PlainDate;
    }) {
      return <RNText>{`horoscope:${date.toString()}`}</RNText>;
    },
  };
});

const DATE = Temporal.PlainDate.from("2026-08-09");

const renderStep = (id: TRitualStepId) => {
  const step = [...RITUAL_STEPS.am, ...RITUAL_STEPS.pm].find(
    (candidate) => candidate.id === id,
  )!;
  return render(<RitualStepView date={DATE} step={step} />);
};

describe("RitualStepView", () => {
  it("renders the horoscope step for the horoscope id", () => {
    const screen = renderStep("horoscope");

    expect(screen.getByText("horoscope:2026-08-09")).toBeTruthy();
  });

  // DEX-128 filled in the first step; the rest still render their name centered
  // until their own DEX-34 sub-issue replaces them. A step that quietly stopped
  // rendering anything would otherwise look like an empty screen.
  it.each(
    [...RITUAL_STEPS.am, ...RITUAL_STEPS.pm].filter(
      (step) => step.id !== "horoscope",
    ),
  )("renders $title as a placeholder", (step) => {
    const screen = render(<RitualStepView date={DATE} step={step} />);

    expect(screen.getByText(step.title)).toBeTruthy();
  });

  it("hands the ritual's date to the step rather than today's", () => {
    const other = Temporal.PlainDate.from("2026-01-02");
    const step = RITUAL_STEPS.am[0];

    const screen = render(<RitualStepView date={other} step={step} />);

    expect(screen.getByText("horoscope:2026-01-02")).toBeTruthy();
  });
});
