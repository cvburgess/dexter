import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { Text, TouchableOpacity } from "react-native";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";

import { createRitualState, type TRitualState } from "@/utils/ritualSteps";

import type { TDateFieldProps } from "../DateField.types";
import type { TRitualStepSwitcherProps } from "../RitualStepSwitcher.types";
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

// The step switcher is platform-split and covered by its own test; stand it in
// with a pressable per step so this file can assert what the header wires up
// without a native menu host.
const mockStepSwitcher = ({
  state: ritual,
  onSelectStep,
}: TRitualStepSwitcherProps) => (
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
  RitualStepSwitcher: (props: TRitualStepSwitcherProps) =>
    mockStepSwitcher(props),
}));

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
      state={state()}
      {...props}
    />,
  );

describe("SmallScreenRitual", () => {
  it("renders the step the state points at", () => {
    const screen = renderRitual({ state: state({ step: 2 }) });

    expect(screen.getByText("Calendar")).toBeTruthy();
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
  // the user can still jump back out of Congrats.
  it("keeps the switcher on the last step", () => {
    const screen = renderRitual({ state: state({ step: 5 }) });

    expect(screen.getByText("Congrats")).toBeTruthy();
    expect(screen.getByText("switcher:am:5")).toBeTruthy();
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
      renderRitual({ onSwipe, state: state({ step: 5 }) });

      fireGestureHandler(getByGestureTestId("page-swipe"), [
        { translationX: -200, velocityX: -900 },
      ]);

      expect(onSwipe).not.toHaveBeenCalled();
    });
  });

  describe("on the tab", () => {
    it("offers the mode switch, labelled with where it goes", () => {
      const onToggleMode = jest.fn();
      const screen = renderRitual({ onToggleMode });

      fireEvent.press(screen.getByLabelText("Switch to the evening ritual"));

      expect(onToggleMode).toHaveBeenCalledTimes(1);
      expect(screen.queryByLabelText("Close ritual")).toBeNull();
    });

    it("labels the switch the other way round in the evening", () => {
      const screen = renderRitual({
        onToggleMode: jest.fn(),
        state: state({ mode: "pm" }),
      });

      expect(
        screen.getByLabelText("Switch to the morning ritual"),
      ).toBeTruthy();
    });
  });

  describe("in the modal", () => {
    // The mode is chosen in the toolbar that opened the modal, so the leading
    // slot carries the close instead of the switch.
    it("offers the close in place of the mode switch", () => {
      const onClose = jest.fn();
      const screen = renderRitual({ onClose });

      fireEvent.press(screen.getByLabelText("Close ritual"));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByLabelText("Switch to the evening ritual"),
      ).toBeNull();
    });
  });
});
