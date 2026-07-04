import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";

import { DayNav } from "../DayNav";

describe("DayNav", () => {
  const date = Temporal.PlainDate.from("2026-07-03"); // a Friday

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
});
