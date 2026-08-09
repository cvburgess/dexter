import { fireEvent, render } from "@testing-library/react-native";
import { Text, TouchableOpacity } from "react-native";

import RitualSessionScreen from "@/app/(app)/ritual-session";
import { ritualStepOptions } from "@/components/RitualStepSwitcher.shared";
import type { TRitualStepSwitcherProps } from "@/components/RitualStepSwitcher.types";
import { useDismissModal } from "@/hooks/useDismissModal";

import type { TDateFieldProps } from "../../components/DateField.types";

const mockParams: { current: Record<string, string | string[]> } = {
  current: {},
};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams.current,
}));
jest.mock("@/hooks/useDismissModal", () => ({
  useDismissModal: jest.fn(),
}));

// `DayNav` renders `DateField` — a native picker with no test double — whenever
// the viewed day is today. The `mock` prefix satisfies Jest's hoisting rule.
const mockDateField = (props: TDateFieldProps) => (
  <TouchableOpacity accessibilityLabel="Pick a date" onPress={jest.fn()}>
    <Text>{props.value.toISOString()}</Text>
  </TouchableOpacity>
);
jest.mock("@/components/DateField", () => ({
  DateField: (props: TDateFieldProps) => mockDateField(props),
}));

// The step switcher has its own test and a native menu host; stand it in with a
// pressable per step so this file can drive the flow it wires up.
const mockStepSwitcher = ({
  state,
  onSelectStep,
}: TRitualStepSwitcherProps) => (
  <>
    {ritualStepOptions(state, onSelectStep).map((option) => (
      <TouchableOpacity
        accessibilityLabel={`go-to-${option.id}`}
        key={option.index}
        onPress={option.onSelect}
      >
        {/* The row's id, not its title — the step's title is what the body
            renders, and the assertions below read that. */}
        <Text>{`row:${option.id}`}</Text>
      </TouchableOpacity>
    ))}
  </>
);
jest.mock("@/components/RitualStepSwitcher", () => ({
  RitualStepSwitcher: (props: TRitualStepSwitcherProps) =>
    mockStepSwitcher(props),
}));

const mockUseDismissModal = useDismissModal as jest.MockedFunction<
  typeof useDismissModal
>;
const dismiss = jest.fn();

// Local time, not UTC: the fallback reads the device's calendar day and hour.
const localTime = (hour: number) => new Date(2026, 7, 9, hour, 0);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: localTime(9) });
  mockParams.current = {};
  mockUseDismissModal.mockReturnValue(dismiss);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("RitualSessionScreen", () => {
  it("opens on the day and ritual the play button handed it", () => {
    mockParams.current = { date: "2026-12-25", mode: "pm" };
    const screen = render(<RitualSessionScreen />);

    expect(screen.getByText("Friday, Dec 25")).toBeTruthy();
    expect(screen.getByText("Open tasks")).toBeTruthy();
  });

  it("falls back to today's ritual when opened with no params", () => {
    const screen = render(<RitualSessionScreen />);

    expect(screen.getByText("Horoscope")).toBeTruthy();
  });

  // The route is linkable on web, so a hand-edited or stale URL is real: both
  // params fall back rather than throwing.
  it.each([
    ["an impossible date", { date: "2026-02-30" }],
    ["an unrecognized mode", { mode: "evening" }],
  ])("falls back on %s", (_label, params) => {
    mockParams.current = params;
    const screen = render(<RitualSessionScreen />);

    expect(screen.getByText("Horoscope")).toBeTruthy();
  });

  it("jumps to a step picked from the switcher", () => {
    const screen = render(<RitualSessionScreen />);

    fireEvent.press(screen.getByLabelText("go-to-calendar"));

    expect(screen.getByText("Calendar")).toBeTruthy();
  });

  it("closes through the modal dismiss, not a bare back()", () => {
    const screen = render(<RitualSessionScreen />);

    fireEvent.press(screen.getByLabelText("Close ritual"));

    expect(mockUseDismissModal).toHaveBeenCalledWith("/ritual");
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  // The mode is chosen in the toolbar that opened this, so the leading slot
  // carries the close instead — and there is no ✓ here, since a ritual step
  // saves nothing.
  it("offers neither the mode switch nor a save action", () => {
    const screen = render(<RitualSessionScreen />);

    expect(screen.queryByLabelText("Switch to the evening ritual")).toBeNull();
    expect(screen.queryByTestId("modal-done-button")).toBeNull();
  });
});
