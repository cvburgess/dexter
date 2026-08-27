import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { Text, TouchableOpacity } from "react-native";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";

import { createRitualState, type TRitualState } from "@/utils/ritualSteps";

import type { TDateFieldProps } from "../DateField.types";
import { LargeScreenRitual } from "../LargeScreenRitual";

// DateField is a native picker with no test double.
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

// Stands in for the step's title, date, and a pressable that reports focus
// so this file can assert the swipe suspends.
const mockStepView = ({
  step,
  date,
  onEditingChange,
}: {
  step: { title: string };
  date: Temporal.PlainDate;
  onEditingChange: (editing: boolean) => void;
}) => (
  <>
    <Text>{step.title}</Text>
    <Text>{`step-date:${date.toString()}`}</Text>
    <TouchableOpacity
      accessibilityLabel="focus-field"
      onPress={() => onEditingChange(true)}
    >
      <Text>focus</Text>
    </TouchableOpacity>
  </>
);
jest.mock("../RitualStepView", () => ({
  RitualStepView: (props: Parameters<typeof mockStepView>[0]) =>
    mockStepView(props),
}));

// Records the pager's props while rendering the real one, so swipe tests
// stay end-to-end — fireGestureHandler binds at mount.
const mockSwipeablePage = jest.fn();
jest.mock("../SwipeablePage", () => {
  const actual = jest.requireActual("../SwipeablePage");
  return {
    ...actual,
    SwipeablePage: (props: Record<string, unknown>) => {
      mockSwipeablePage(props);
      return <actual.SwipeablePage {...props} />;
    },
  };
});

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
      onSwipe={jest.fn()}
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

  it("hands the step the ritual's day", () => {
    const screen = renderRitual({ state: state({ step: 2 }) });

    expect(screen.getByText("step-date:2026-08-09")).toBeTruthy();
  });

  // The ritual runs in the tab now, not behind a play button in a modal.
  it("renders the step's own content in the body", () => {
    const screen = renderRitual({ state: state({ step: 2 }) });

    expect(screen.getByText("Calendar")).toBeTruthy();
  });

  it("renders the evening ritual's own steps", () => {
    const screen = renderRitual({ state: state({ mode: "pm", step: 0 }) });

    expect(screen.getByText("Breathe")).toBeTruthy();
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

  // Unlike large-screen Today, which has none — a ritual is a sequence to
  // move through, so the gesture is offered alongside the segments.
  describe("the swipe", () => {
    it("pages forward", () => {
      const onSwipe = jest.fn();
      renderRitual({ onSwipe, state: state({ step: 1 }) });

      fireGestureHandler(getByGestureTestId("page-swipe"), [
        { translationX: -200, velocityX: -900 },
      ]);

      expect(onSwipe).toHaveBeenCalledWith(1);
    });

    it("pages back", () => {
      const onSwipe = jest.fn();
      renderRitual({ onSwipe, state: state({ step: 1 }) });

      fireGestureHandler(getByGestureTestId("page-swipe"), [
        { translationX: 200, velocityX: 900 },
      ]);

      expect(onSwipe).toHaveBeenCalledWith(-1);
    });

    // `canPrev`/`canNext` are threaded here too, so the pager declines the
    // gesture itself rather than stranding the drag off-screen.
    it("is declined before the first step", () => {
      const onSwipe = jest.fn();
      renderRitual({ onSwipe });

      fireGestureHandler(getByGestureTestId("page-swipe"), [
        { translationX: 200, velocityX: 900 },
      ]);

      expect(onSwipe).not.toHaveBeenCalled();
    });

    it("is declined past the last step", () => {
      const onSwipe = jest.fn();
      renderRitual({ onSwipe, state: state({ step: 4 }) });

      fireGestureHandler(getByGestureTestId("page-swipe"), [
        { translationX: -200, velocityX: -900 },
      ]);

      expect(onSwipe).not.toHaveBeenCalled();
    });
  });

  // The journal step's response fields are the reason: a focused field owns
  // horizontal drags for caret/selection, so the pager has to stand down.
  it("is suspended while a step reports it is being edited", () => {
    const screen = renderRitual({ state: state({ step: 1 }) });

    expect(mockSwipeablePage).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );

    fireEvent.press(screen.getByLabelText("focus-field"));

    expect(mockSwipeablePage).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });
});
