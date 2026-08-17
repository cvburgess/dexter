import { Temporal } from "@js-temporal/polyfill";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { BreatheStep } from "@/components/BreatheStep";
import { usePreferences } from "@/hooks/usePreferences";
import {
  pickerOptionsFor,
  pickerPropsFor,
  resetPicker,
} from "@/testUtils/mockExpoUiPicker";
import { techniqueForDay } from "@/utils/breathing";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));

// The step's technique control is a `PickerField`; the global @expo/ui mock
// renders Picker as null, so capture its props to inspect and drive it.
jest.mock("@expo/ui", () =>
  jest
    .requireActual<typeof import("@/testUtils/mockExpoUiPicker")>(
      "@/testUtils/mockExpoUiPicker",
    )
    .mockExpoUiPicker(),
);

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;

const DATE = Temporal.PlainDate.from("2026-08-09");

const mockUpdate = jest.fn();

const withPreferences = (
  preferences: { breathCount?: number; breathingTechnique?: string } = {},
) =>
  mockUsePreferences.mockReturnValue([
    {
      breathCount: 3,
      breathingTechnique: "shuffle",
      ...preferences,
    } as never,
    { updatePreferences: mockUpdate },
  ]);

const renderStep = (date = DATE) => render(<BreatheStep date={date} />);

beforeEach(() => {
  resetPicker();
  mockUpdate.mockClear();
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

  // The three real techniques and not `shuffle`: choosing "whichever" for a
  // session you are about to start is not a choice. Settings offers the fourth.
  it("offers the three techniques without shuffle", () => {
    renderStep();

    expect(
      pickerOptionsFor("breathe-technique-picker").map((o) => o.value),
    ).toEqual(["simple", "relax", "box"]);
  });

  it("seeds the technique from the stored preference", () => {
    withPreferences({ breathingTechnique: "box" });
    renderStep();

    expect(pickerPropsFor("breathe-technique-picker")?.selectedValue).toBe(
      "box",
    );
  });

  it("resolves a shuffled preference to the technique this day runs", () => {
    withPreferences({ breathingTechnique: "shuffle" });
    renderStep();

    expect(pickerPropsFor("breathe-technique-picker")?.selectedValue).toBe(
      techniqueForDay("shuffle", DATE),
    );
  });

  it("changes the technique for this sitting", () => {
    withPreferences({ breathingTechnique: "simple" });
    renderStep();

    act(() => {
      (
        pickerPropsFor("breathe-technique-picker")?.onValueChange as (
          value: string,
        ) => void
      )("relax");
    });

    expect(pickerPropsFor("breathe-technique-picker")?.selectedValue).toBe(
      "relax",
    );
  });

  // The preference seeds the step and nothing writes back to it — the slider
  // changes this sitting only, which `SwipeablePage`'s remount resets.
  it("changes the count for this sitting without storing it", () => {
    renderStep();

    act(() => {
      fireEvent(
        screen.getByTestId("breathe-count-slider"),
        "accessibilityAction",
        { nativeEvent: { actionName: "increment" } },
      );
    });

    expect(screen.getByText("4 breaths")).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
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
