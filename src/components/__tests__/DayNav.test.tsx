import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { Text, TouchableOpacity } from "react-native";

import type { TDateFieldProps } from "../DateField.types";
import { DayNav } from "../DayNav";

const SELECTED_DATE = new Date(2026, 11, 25); // Dec 25, 2026 (month is 0-based)

// `DateField` wraps a native SwiftUI/community picker with no test double, so
// stand it in with a pressable that surfaces the props `DayNav` wires up: the
// `value` it renders and the `Date` it emits from `onChange`.
const mockDateField = jest.fn((props: TDateFieldProps) => (
  <TouchableOpacity
    accessibilityLabel="Pick a date"
    onPress={() => props.onChange(SELECTED_DATE)}
  >
    <Text>{props.value.toISOString()}</Text>
  </TouchableOpacity>
));
jest.mock("../DateField", () => ({
  DateField: (props: Parameters<typeof mockDateField>[0]) =>
    mockDateField(props),
}));

describe("DayNav", () => {
  const date = Temporal.PlainDate.from("2026-07-03"); // a Friday, not today

  it("shows the centered date as weekday, month, day", () => {
    const screen = render(<DayNav date={date} onChangeDate={jest.fn()} />);

    expect(screen.getByText("Friday, Jul 3")).toBeTruthy();
  });

  it("moves the date back one day when the previous arrow is pressed", () => {
    const onChangeDate = jest.fn();
    const screen = render(<DayNav date={date} onChangeDate={onChangeDate} />);

    fireEvent.press(screen.getByLabelText("Previous day"));

    expect(onChangeDate).toHaveBeenCalledWith(
      Temporal.PlainDate.from("2026-07-02"),
    );
  });

  it("moves the date forward one day when the next arrow is pressed", () => {
    const onChangeDate = jest.fn();
    const screen = render(<DayNav date={date} onChangeDate={onChangeDate} />);

    fireEvent.press(screen.getByLabelText("Next day"));

    expect(onChangeDate).toHaveBeenCalledWith(
      Temporal.PlainDate.from("2026-07-04"),
    );
  });

  it("jumps to today when the date is pressed on a non-today day", () => {
    const onChangeDate = jest.fn();
    const screen = render(
      <DayNav date={date.add({ days: 10 })} onChangeDate={onChangeDate} />,
    );

    // The center control is the "go to today" shortcut, not the picker.
    expect(screen.queryByLabelText("Open date picker")).toBeNull();

    fireEvent.press(screen.getByLabelText("Go to today"));

    expect(onChangeDate).toHaveBeenCalledWith(Temporal.Now.plainDateISO());
  });

  describe("when viewing today", () => {
    const today = Temporal.Now.plainDateISO();

    it("renders the date picker instead of the go-to-today shortcut", () => {
      const screen = render(<DayNav date={today} onChangeDate={jest.fn()} />);

      expect(screen.getByLabelText("Open date picker")).toBeTruthy();
      expect(screen.queryByLabelText("Go to today")).toBeNull();
    });

    it("does not call onChangeDate just from rendering the picker", () => {
      const onChangeDate = jest.fn();
      render(<DayNav date={today} onChangeDate={onChangeDate} />);

      expect(onChangeDate).not.toHaveBeenCalled();
    });

    it("passes today to the picker as a native Date", () => {
      const screen = render(<DayNav date={today} onChangeDate={jest.fn()} />);

      const expected = new Date(today.year, today.month - 1, today.day);
      expect(screen.getByText(expected.toISOString())).toBeTruthy();
    });

    it("calls onChangeDate once with the selected date as a Temporal.PlainDate", () => {
      const onChangeDate = jest.fn();
      const screen = render(
        <DayNav date={today} onChangeDate={onChangeDate} />,
      );

      fireEvent.press(screen.getByLabelText("Pick a date"));

      expect(onChangeDate).toHaveBeenCalledTimes(1);
      expect(onChangeDate).toHaveBeenCalledWith(
        Temporal.PlainDate.from({
          year: SELECTED_DATE.getFullYear(),
          month: SELECTED_DATE.getMonth() + 1,
          day: SELECTED_DATE.getDate(),
        }),
      );
    });
  });
});
