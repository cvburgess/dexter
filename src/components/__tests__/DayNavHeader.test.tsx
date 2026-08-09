import { Temporal } from "@js-temporal/polyfill";
import { render } from "@testing-library/react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { TDateFieldProps } from "../DateField.types";
import { DayNavHeader } from "../DayNavHeader";

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

const date = Temporal.PlainDate.from("2026-07-03");

const withControls = () =>
  render(
    <DayNavHeader
      date={date}
      leading={<View testID="leading-control" />}
      onChangeDate={jest.fn()}
      trailing={<View testID="trailing-control" />}
    />,
  );

describe("DayNavHeader", () => {
  it("renders the nav on its own when given no controls", () => {
    const screen = render(
      <DayNavHeader date={date} onChangeDate={jest.fn()} />,
    );

    expect(screen.getByLabelText("Next day")).toBeTruthy();
    expect(screen.queryByTestId("day-nav-leading")).toBeNull();
    expect(screen.queryByTestId("day-nav-trailing")).toBeNull();
  });

  it("renders a control in each slot alongside the nav", () => {
    const screen = withControls();

    expect(screen.getByTestId("leading-control")).toBeTruthy();
    expect(screen.getByTestId("trailing-control")).toBeTruthy();
    expect(screen.getByLabelText("Previous day")).toBeTruthy();
    expect(screen.getByLabelText("Next day")).toBeTruthy();
  });

  // The load-bearing property: overlaying rather than flexing is what keeps the
  // nav screen-centered. A control taking row space would push it off-center,
  // and two controls of different widths — Ritual pairs a round button with a
  // text one — would push it off-center by different amounts on each side.
  it.each([
    ["day-nav-leading", "left"],
    ["day-nav-trailing", "right"],
  ])("overlays %s against its own edge", (testID, edge) => {
    const screen = withControls();

    const style = StyleSheet.flatten(screen.getByTestId(testID).props.style);

    expect(style.position).toBe("absolute");
    expect(style[edge as "left" | "right"]).toBeGreaterThan(0);
  });
});
