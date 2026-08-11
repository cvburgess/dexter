import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { Text, TouchableOpacity } from "react-native";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";

import { createRitualState, type TRitualState } from "@/utils/ritualSteps";

import type { TDateFieldProps } from "../DateField.types";
import { SmallScreenRitual } from "../SmallScreenRitual";

// `DateField` wraps a native picker with no test double; `DayNav` renders it
// whenever the viewed day is today. The `mock` prefix satisfies Jest's hoisting
// rule, as in `DayNav.test.tsx`.
const mockDateField = (props: TDateFieldProps) => (
  <TouchableOpacity accessibilityLabel="Pick a date" onPress={jest.fn()}>
    <Text>{props.value.toISOString()}</Text>
  </TouchableOpacity>
);
jest.mock("../DateField", () => ({
  DateField: (props: TDateFieldProps) => mockDateField(props),
}));

// The step switcher has its own test and a native menu host; stand it in with a
// marker and a pressable so this file can assert what the header wires up.
const mockStepSwitcher = ({
  state: ritual,
  onSelectStep,
}: {
  state: TRitualState;
  onSelectStep: (index: number) => void;
}) => (
  <>
    <Text>{`switcher:${ritual.mode}:${ritual.step}`}</Text>
    <TouchableOpacity
      accessibilityLabel="pick-step-3"
      onPress={() => onSelectStep(3)}
    >
      <Text>pick</Text>
    </TouchableOpacity>
  </>
);
jest.mock("../RitualStepSwitcher", () => ({
  RitualStepSwitcher: (props: Parameters<typeof mockStepSwitcher>[0]) =>
    mockStepSwitcher(props),
}));

// The step content has its own test and (for the journal) needs a query client
// and a session; stand it in with the step's title, the date it was handed, and
// a pressable that reports focus so this file can assert the swipe suspends.
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

// Records what the layout hands the pager while still rendering the real one,
// so the swipe tests below stay end-to-end. `fireGestureHandler` binds the
// handler at mount, so an `enabled` that flips *after* mount can only be
// observed as a prop.
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
  props: Partial<Parameters<typeof SmallScreenRitual>[0]>,
) =>
  render(
    <SmallScreenRitual
      onChangeDate={jest.fn()}
      onSelectStep={jest.fn()}
      onSwipe={jest.fn()}
      onToggleMode={jest.fn()}
      state={state()}
      {...props}
    />,
  );

describe("SmallScreenRitual", () => {
  it("renders the step the state points at", () => {
    const screen = renderRitual({ state: state({ step: 2 }) });

    expect(screen.getByText("Calendar")).toBeTruthy();
  });

  it("hands the step the ritual's day", () => {
    const screen = renderRitual({ state: state({ step: 2 }) });

    expect(screen.getByText("step-date:2026-08-09")).toBeTruthy();
  });

  it("renders the evening ritual's own steps", () => {
    const screen = renderRitual({ state: state({ mode: "pm", step: 0 }) });

    expect(screen.getByText("Open tasks")).toBeTruthy();
  });

  it("hands the switcher the step on screen", () => {
    const screen = renderRitual({ state: state({ mode: "pm", step: 2 }) });

    expect(screen.getByText("switcher:pm:2")).toBeTruthy();
  });

  it("jumps to the step the switcher picked", () => {
    const onSelectStep = jest.fn();
    const screen = renderRitual({ onSelectStep });

    fireEvent.press(screen.getByLabelText("pick-step-3"));

    expect(onSelectStep).toHaveBeenCalledWith(3);
  });

  // The switcher is navigation, not progression — it stays on the last step so
  // the user can still jump back out of Summary.
  it("keeps the switcher on the last step", () => {
    const screen = renderRitual({ state: state({ step: 4 }) });

    expect(screen.getByText("Summary")).toBeTruthy();
    expect(screen.getByText("switcher:am:4")).toBeTruthy();
  });

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

    // Proves `canPrev`/`canNext` are threaded through: the pager declines the
    // gesture itself, so the content springs back instead of being stranded
    // off-screen waiting for a remount that never comes.
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

  describe("the mode switch", () => {
    it("is labelled with where it goes, not where it is", () => {
      const onToggleMode = jest.fn();
      const screen = renderRitual({ onToggleMode });

      fireEvent.press(screen.getByLabelText("Switch to the evening ritual"));

      expect(onToggleMode).toHaveBeenCalledTimes(1);
    });

    it("labels itself the other way round in the evening", () => {
      const screen = renderRitual({ state: state({ mode: "pm" }) });

      expect(
        screen.getByLabelText("Switch to the morning ritual"),
      ).toBeTruthy();
    });
  });
});
