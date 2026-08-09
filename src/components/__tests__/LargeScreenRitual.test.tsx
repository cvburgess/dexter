import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { Text, TouchableOpacity } from "react-native";

import { createRitualState } from "@/utils/ritualSteps";

import type { TDateFieldProps } from "../DateField.types";
import { LargeScreenRitual } from "../LargeScreenRitual";

const mockRouter = { push: jest.fn() };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));

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

const DATE = Temporal.PlainDate.from("2026-08-09");

const renderRitual = (mode: "am" | "pm" = "am", onToggleMode = jest.fn()) =>
  render(
    <LargeScreenRitual
      onChangeDate={jest.fn()}
      onToggleMode={onToggleMode}
      state={createRitualState(DATE, mode)}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("LargeScreenRitual", () => {
  it("renders the date nav in the toolbar", () => {
    const screen = renderRitual();

    expect(screen.getByLabelText("Next day")).toBeTruthy();
  });

  // "Nothing on the main view for now" (DEX-127) — the flow runs in the modal.
  it("leaves the body empty", () => {
    const screen = renderRitual();

    expect(screen.getByTestId("ritual-empty-body")).toBeTruthy();
    expect(screen.queryByText("Horoscope")).toBeNull();
  });

  it("offers the mode switch", () => {
    const onToggleMode = jest.fn();
    const screen = renderRitual("am", onToggleMode);

    fireEvent.press(screen.getByLabelText("Switch to the evening ritual"));

    expect(onToggleMode).toHaveBeenCalledTimes(1);
  });

  it("opens the session modal on the day and ritual the toolbar is showing", () => {
    const screen = renderRitual("pm");

    fireEvent.press(screen.getByLabelText("Start ritual"));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/ritual-session",
      params: { date: "2026-08-09", mode: "pm" },
    });
  });
});
