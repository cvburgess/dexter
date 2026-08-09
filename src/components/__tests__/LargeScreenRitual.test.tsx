import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { Text, TouchableOpacity } from "react-native";

import { createRitualState, type TRitualState } from "@/utils/ritualSteps";

import type { TDateFieldProps } from "../DateField.types";
import { LargeScreenRitual } from "../LargeScreenRitual";

// `DayNav` renders `DateField` — a native picker with no test double — whenever
// the viewed day is today. The `mock` prefix satisfies Jest's hoisting rule.
const mockDateField = (props: TDateFieldProps) => (
  <TouchableOpacity accessibilityLabel="Pick a date" onPress={jest.fn()}>
    <Text>{props.value.toISOString()}</Text>
  </TouchableOpacity>
);
jest.mock("../DateField", () => ({
  DateField: (props: TDateFieldProps) => mockDateField(props),
}));

// The segmented control has its own test; stand it in with a marker and a
// pressable so this file can assert what the toolbar wires up.
const mockStepSegments = ({
  state,
  onSelectStep,
}: {
  state: TRitualState;
  onSelectStep: (index: number) => void;
}) => (
  <>
    <Text>{`segments:${state.mode}:${state.step}`}</Text>
    <TouchableOpacity
      accessibilityLabel="pick-step-2"
      onPress={() => onSelectStep(2)}
    >
      <Text>pick</Text>
    </TouchableOpacity>
  </>
);
jest.mock("../RitualStepSegments", () => ({
  RitualStepSegments: (props: Parameters<typeof mockStepSegments>[0]) =>
    mockStepSegments(props),
}));

const DATE = Temporal.PlainDate.from("2026-08-09");

const state = (overrides: Partial<TRitualState> = {}): TRitualState => ({
  ...createRitualState(DATE, "am"),
  ...overrides,
});

const renderRitual = (
  props: Partial<Parameters<typeof LargeScreenRitual>[0]> = {},
) =>
  render(
    <LargeScreenRitual
      onChangeDate={jest.fn()}
      onSelectStep={jest.fn()}
      onToggleMode={jest.fn()}
      state={state()}
      {...props}
    />,
  );

describe("LargeScreenRitual", () => {
  it("renders the date nav in the toolbar", () => {
    const screen = renderRitual();

    expect(screen.getByLabelText("Next day")).toBeTruthy();
  });

  // The ritual runs in the tab now, not behind a play button in a modal.
  it("renders the step's own content in the body", () => {
    const screen = renderRitual({ state: state({ step: 2 }) });

    expect(screen.getByText("Calendar")).toBeTruthy();
  });

  it("renders the evening ritual's own steps", () => {
    const screen = renderRitual({ state: state({ mode: "pm", step: 0 }) });

    expect(screen.getByText("Open tasks")).toBeTruthy();
  });

  it("hands the segments the step on screen", () => {
    const screen = renderRitual({ state: state({ mode: "pm", step: 3 }) });

    expect(screen.getByText("segments:pm:3")).toBeTruthy();
  });

  it("jumps to the step the segments picked", () => {
    const onSelectStep = jest.fn();
    const screen = renderRitual({ onSelectStep });

    fireEvent.press(screen.getByLabelText("pick-step-2"));

    expect(onSelectStep).toHaveBeenCalledWith(2);
  });

  it("offers the mode switch", () => {
    const onToggleMode = jest.fn();
    const screen = renderRitual({ onToggleMode });

    fireEvent.press(screen.getByLabelText("Switch to the evening ritual"));

    expect(onToggleMode).toHaveBeenCalledTimes(1);
  });

  // The segments are the way through here, exactly as DayNav's arrows are the
  // only way to change days on the large-screen Today tab.
  it("has no swipe", () => {
    const screen = renderRitual();

    expect(() => screen.getByTestId("page-swipe")).toThrow();
  });
});
