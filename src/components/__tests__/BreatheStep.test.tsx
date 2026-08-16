import { Temporal } from "@js-temporal/polyfill";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { BreatheStep } from "@/components/BreatheStep";
import { usePreferences } from "@/hooks/usePreferences";
import { techniqueForDay } from "@/utils/breathing";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;

const DATE = Temporal.PlainDate.from("2026-08-09");

const withPreferences = (
  preferences: { breathCount?: number; breathingTechnique?: string } = {},
) =>
  mockUsePreferences.mockReturnValue([
    {
      breathCount: 3,
      breathingTechnique: "shuffle",
      ...preferences,
    } as never,
    { updatePreferences: jest.fn() },
  ]);

const renderStep = (date = DATE) => render(<BreatheStep date={date} />);

beforeEach(() => {
  withPreferences();
});

describe("BreatheStep", () => {
  it("opens on the Begin button with its two controls", () => {
    renderStep();

    expect(screen.getByTestId("breathe-begin")).toBeTruthy();
    expect(screen.getByTestId("breathe-count-slider")).toBeTruthy();
    expect(screen.getByText("3 breaths")).toBeTruthy();
    // Nothing to stop until something is running.
    expect(screen.queryByTestId("breathe-stop")).toBeNull();
  });

  it("seeds the count from the stored preference", () => {
    withPreferences({ breathCount: 6 });
    renderStep();

    expect(screen.getByText("6 breaths")).toBeTruthy();
    expect(
      screen.getByTestId("breathe-count-slider").props.accessibilityValue.now,
    ).toBe(6);
  });

  it("counts one breath in the singular", () => {
    withPreferences({ breathCount: 1 });
    renderStep();

    expect(screen.getByText("1 breath")).toBeTruthy();
  });

  it("narrows a count no slider could have produced", () => {
    withPreferences({ breathCount: 40 });
    renderStep();

    expect(screen.getByText("10 breaths")).toBeTruthy();
  });

  it("seeds the technique from the stored preference", () => {
    withPreferences({ breathingTechnique: "box" });
    renderStep();

    expect(
      screen.getByTestId("breathe-technique-box").props.accessibilityState
        .selected,
    ).toBe(true);
  });

  it("resolves a shuffled preference to the technique this day runs", () => {
    withPreferences({ breathingTechnique: "shuffle" });
    renderStep();

    const today = techniqueForDay("shuffle", DATE);
    expect(
      screen.getByTestId(`breathe-technique-${today}`).props.accessibilityState
        .selected,
    ).toBe(true);
  });

  it("changes the technique for this sitting", () => {
    withPreferences({ breathingTechnique: "simple" });
    renderStep();

    fireEvent.press(screen.getByTestId("breathe-technique-relax"));

    expect(
      screen.getByTestId("breathe-technique-relax").props.accessibilityState
        .selected,
    ).toBe(true);
  });

  it("takes the controls out of the way and offers a way out once a run starts", () => {
    renderStep();

    act(() => {
      fireEvent.press(screen.getByTestId("breathe-begin"));
    });

    expect(screen.getByTestId("breathe-stop")).toBeTruthy();
    // Still mounted so it can fade back in, but untappable meanwhile —
    // otherwise Begin stays live under the run and a second press restarts it.
    expect(screen.getByTestId("breathe-begin")).toBeTruthy();
    expect(screen.getByTestId("breathe-controls").props.pointerEvents).toBe(
      "none",
    );
  });

  it("gives the controls back when the run is tapped away", () => {
    renderStep();

    act(() => {
      fireEvent.press(screen.getByTestId("breathe-begin"));
    });
    act(() => {
      fireEvent.press(screen.getByTestId("breathe-stop"));
    });

    expect(screen.queryByTestId("breathe-stop")).toBeNull();
    expect(screen.getByTestId("breathe-begin")).toBeTruthy();
    expect(screen.getByTestId("breathe-controls").props.pointerEvents).toBe(
      "auto",
    );
  });
});
